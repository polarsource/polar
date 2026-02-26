#!/usr/bin/env node
/**
 * Codemod: replace <p> and <span> with <Text /> from @polar-sh/orbit
 *
 * Usage:
 *   node codemods/p-span-to-text.mjs [--dry-run] [glob]
 *
 * Examples:
 *   node codemods/p-span-to-text.mjs
 *   node codemods/p-span-to-text.mjs --dry-run
 *   node codemods/p-span-to-text.mjs 'apps/web/src/app/(main)/dashboard/**\/*.tsx'
 *
 * Transformations:
 *   <p ...>        →  <Text ...>
 *   </p>           →  </Text>
 *   <span ...>     →  <Text as="span" ...>
 *   </span>        →  </Text>
 *
 * The import { Text } from '@polar-sh/orbit' is added/updated automatically.
 *
 * Skips files that already have no <p> or <span> JSX elements, and files
 * that appear to be test files or node_modules.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { createRequire } from 'node:module'
import { glob } from 'node:fs/promises'

// ─── Load TypeScript from the web app's node_modules ─────────────────────────

const require = createRequire(import.meta.url)
const ts = require('../apps/web/node_modules/typescript/lib/typescript.js')

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const patternArg = args.find((a) => !a.startsWith('--'))
const pattern = patternArg ?? 'apps/web/src/**/*.tsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTextFromNode(node, sourceFile) {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd())
}

// ─── Core transform ──────────────────────────────────────────────────────────

/**
 * Transforms a single TSX source string.
 * Returns { code, changed } where `changed` is true if anything was modified.
 */
function transform(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  /** @type {Array<{start: number, end: number, replacement: string}>} */
  const edits = []
  let needsTextImport = false

  // ── Visitor ──────────────────────────────────────────────────────────────

  function visit(node) {
    // Opening tags and self-closing elements
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = getTextFromNode(node.tagName, sourceFile)

      if (tagName === 'p') {
        needsTextImport = true
        edits.push({
          start: node.tagName.getStart(sourceFile),
          end: node.tagName.getEnd(),
          replacement: 'Text',
        })
      } else if (tagName === 'span') {
        needsTextImport = true
        // Replace `span` with `Text as="span"`.
        // Any existing attributes stay in place naturally because they come after
        // the tag name position.
        edits.push({
          start: node.tagName.getStart(sourceFile),
          end: node.tagName.getEnd(),
          replacement: 'Text as="span"',
        })
      }
    }

    // Closing tags
    if (ts.isJsxClosingElement(node)) {
      const tagName = getTextFromNode(node.tagName, sourceFile)
      if (tagName === 'p' || tagName === 'span') {
        edits.push({
          start: node.tagName.getStart(sourceFile),
          end: node.tagName.getEnd(),
          replacement: 'Text',
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (edits.length === 0) return { code: source, changed: false }

  // ── Apply edits in reverse order ─────────────────────────────────────────

  edits.sort((a, b) => b.start - a.start)
  let code = source
  for (const { start, end, replacement } of edits) {
    code = code.slice(0, start) + replacement + code.slice(end)
  }

  // ── Import handling ───────────────────────────────────────────────────────

  if (needsTextImport) {
    code = ensureTextImport(code, filePath)
  }

  return { code, changed: true }
}

/**
 * Ensures `Text` is imported from `@polar-sh/orbit` in the given source string.
 * - If an import from `@polar-sh/orbit` already exists and includes `Text` → no-op
 * - If an import from `@polar-sh/orbit` exists without `Text` → adds `Text` to it
 * - If no such import exists → prepends one after any 'use client'/'use server' directive
 */
function ensureTextImport(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  let orbitImportNode = null

  for (const stmt of sourceFile.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === '@polar-sh/orbit'
    ) {
      orbitImportNode = stmt
      break
    }
  }

  if (orbitImportNode) {
    const clause = orbitImportNode.importClause
    const namedBindings = clause?.namedBindings

    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      // Unusual shape — leave it alone
      return source
    }

    const names = namedBindings.elements.map((el) => el.name.text)
    if (names.includes('Text')) {
      // Already imported
      return source
    }

    // Insert `Text` into the named import list, keeping names sorted.
    const sorted = [...names, 'Text'].sort()
    const start = namedBindings.getStart(sourceFile)
    const end = namedBindings.getEnd()
    const newBindings = `{ ${sorted.join(', ')} }`
    return source.slice(0, start) + newBindings + source.slice(end)
  }

  // No @polar-sh/orbit import — add one.
  // Insert after the first 'use client'/'use server' directive (if any), or at
  // the very top of the file.
  let insertPos = 0
  for (const stmt of sourceFile.statements) {
    if (
      ts.isExpressionStatement(stmt) &&
      ts.isStringLiteral(stmt.expression) &&
      (stmt.expression.text === 'use client' ||
        stmt.expression.text === 'use server')
    ) {
      insertPos = stmt.getEnd()
      // Skip the newline after the directive
      if (source[insertPos] === '\n') insertPos++
      break
    }
  }

  const importLine = `import { Text } from '@polar-sh/orbit'\n`
  return source.slice(0, insertPos) + importLine + source.slice(insertPos)
}

// ─── File collection ─────────────────────────────────────────────────────────

async function collectFiles() {
  const files = []
  for await (const entry of glob(pattern, {
    cwd: resolve(import.meta.dirname, '..'),
    absolute: true,
  })) {
    // Skip node_modules, .next, test files, orbit demo pages (already updated)
    if (
      entry.includes('node_modules') ||
      entry.includes('/.next/') ||
      entry.endsWith('.test.tsx') ||
      entry.endsWith('.spec.tsx')
    ) {
      continue
    }
    files.push(entry)
  }
  return files
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const root = resolve(import.meta.dirname, '..')
  const files = await collectFiles()

  let changed = 0
  let skipped = 0

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8')

    // Quick pre-check — skip if no <p or <span in source (fast path)
    if (!/<p[\s/>]/.test(source) && !/<span[\s/>]/.test(source)) {
      skipped++
      continue
    }

    const { code, changed: didChange } = transform(source, filePath)

    if (!didChange) {
      skipped++
      continue
    }

    const rel = relative(root, filePath)
    if (dryRun) {
      console.log(`[dry-run] would transform: ${rel}`)
    } else {
      writeFileSync(filePath, code, 'utf-8')
      console.log(`transformed: ${rel}`)
    }
    changed++
  }

  console.log(
    `\nDone. ${changed} file(s) ${dryRun ? 'would be ' : ''}transformed, ${skipped} skipped.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
