#!/usr/bin/env node
/**
 * Codemod: add `eslint-disable-next-line no-restricted-syntax` comments for
 * raw <span>, <p>, and <code> JSX elements.
 *
 * Usage:
 *   node codemods/disable-restricted-syntax.mjs [--dry-run] [glob]
 *
 * Examples:
 *   node codemods/disable-restricted-syntax.mjs
 *   node codemods/disable-restricted-syntax.mjs --dry-run
 *   node codemods/disable-restricted-syntax.mjs 'apps/web/src/app/(main)/dashboard/**\/*.tsx'
 *
 * Comment style:
 *   - Direct JSX child  → {/* eslint-disable-next-line no-restricted-syntax *\/}
 *   - JS/expression ctx → // eslint-disable-next-line no-restricted-syntax
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

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_TAGS = new Set(['span', 'p', 'code', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const DISABLE_COMMENT = 'eslint-disable-next-line no-restricted-syntax'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the source position of the start of the line containing `pos`. */
function lineStartOf(source, pos) {
  let i = pos - 1
  while (i >= 0 && source[i] !== '\n') i--
  return i + 1
}

/** Returns the text of the line immediately before the line containing `pos`. */
function prevLineText(source, pos) {
  const ls = lineStartOf(source, pos)
  if (ls === 0) return ''
  let i = ls - 2 // skip the \n
  while (i >= 0 && source[i] !== '\n') i--
  return source.slice(i + 1, ls - 1)
}

/**
 * Returns true when the element should receive a JSX-style disable comment
 * ({/* … *\/}) rather than a JS line comment (//).
 *
 * A JSX comment is required whenever the INSERTION LINE would be rendered as
 * JSX text content — i.e. the element is a direct child of a JsxElement /
 * JsxFragment children list, without being wrapped in a {expression}.
 */
function needsJsxComment(node) {
  // For opening elements the parent is the enclosing JsxElement; go one
  // level higher to find the children-list owner.
  let container = ts.isJsxOpeningElement(node) ? node.parent : node

  let p = container.parent
  while (p && !ts.isSourceFile(p)) {
    // Inside a {…} expression — JS context, // is fine.
    if (ts.isJsxExpression(p)) return false
    // Direct child of a JSX element or fragment — needs {/* */}.
    if (ts.isJsxElement(p) || ts.isJsxFragment(p)) return true
    p = p.parent
  }
  // Pure JS context (return statement, variable, etc.).
  return false
}

/**
 * Returns true when the element is nested inside a JsxExpression that is
 * itself a JSX child, but with intermediate non-JSX nodes between the element
 * and the JsxExpression — typically a `&&` or ternary binary expression.
 *
 * Example: {!isCollapsed && <span>Support</span>}
 *
 * In this case a `// eslint-disable-next-line` placed before the outer `{…}`
 * line does NOT suppress the rule on the inner element. We must instead wrap
 * the element in a Fragment and place the JSX comment inside it:
 *   {!isCollapsed && <>{/* eslint-disable-next-line no-restricted-syntax *\/}<span>…</span></>}
 */
function isNestedInJsxExpression(node) {
  const element = ts.isJsxOpeningElement(node) ? node.parent : node
  let p = element.parent
  while (p && !ts.isSourceFile(p)) {
    if (ts.isJsxExpression(p)) {
      // Direct child of the expression (e.g. {<span>}) — not the nested case.
      if (element.parent === p) return false
      // There are intermediate nodes (BinaryExpression, ConditionalExpression,
      // etc.). Only treat as nested if the JsxExpression is itself a JSX child.
      const pp = p.parent
      return ts.isJsxElement(pp) || ts.isJsxFragment(pp)
    }
    // Hit a JSX container before any JsxExpression — not the nested case.
    if (ts.isJsxElement(p) || ts.isJsxFragment(p)) return false
    p = p.parent
  }
  return false
}

// ─── Core transform ──────────────────────────────────────────────────────────

/**
 * Inserts eslint-disable-next-line comments for target elements.
 * Returns { code, changed }.
 */
function transform(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  // Map from line-start offset → insertion text.
  // Using the line start as key deduplicates multiple elements on one line.
  const insertions = new Map()

  // Fragment-wrap edits: { start, end } of the element node to wrap.
  const wraps = []

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile)

      if (TARGET_TAGS.has(tagName)) {
        const elemStart = node.getStart(sourceFile)
        const element = ts.isJsxOpeningElement(node) ? node.parent : node

        // Skip if already disabled.
        // Check 1: previous line has the disable comment (standard insertion).
        const prev = prevLineText(source, elemStart)
        if (
          prev.includes('eslint-disable-next-line') &&
          prev.includes('no-restricted-syntax')
        ) {
          ts.forEachChild(node, visit)
          return
        }
        // Check 2: the disable comment appears inline before this element inside
        // its direct parent (handles already-fragment-wrapped elements on re-run).
        const inlinePrefix = source.slice(element.parent.getStart(sourceFile), elemStart)
        if (inlinePrefix.includes(DISABLE_COMMENT)) {
          ts.forEachChild(node, visit)
          return
        }

        if (isNestedInJsxExpression(node)) {
          // A plain line comment before the `{cond && <elem>}` line won't
          // suppress the rule on the element. Wrap it in a fragment instead:
          //   {cond && <>{/* eslint-disable-next-line … */}<elem/></>}
          wraps.push({ start: element.getStart(sourceFile), end: element.getEnd() })
        } else {
          const ls = lineStartOf(source, elemStart)
          if (!insertions.has(ls)) {
            const indentation = source.slice(ls).match(/^(\s*)/)[1]
            const useJsx = needsJsxComment(node)
            const commentLine = useJsx
              ? `${indentation}{/* ${DISABLE_COMMENT} */}\n`
              : `${indentation}// ${DISABLE_COMMENT}\n`
            insertions.set(ls, { pos: ls, text: commentLine })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (insertions.size === 0 && wraps.length === 0) return { code: source, changed: false }

  // Combine all edits and apply in reverse position order so earlier offsets
  // stay valid. Wrap suffix (</>) must come before wrap prefix in the sort so
  // that inserting at `end` happens before inserting at `start`.
  const edits = [
    ...[...insertions.values()].map(({ pos, text }) => ({ pos, text })),
    ...wraps.flatMap(({ start, end }) => [
      { pos: end,   text: '</>' },
      { pos: start, text: `<>{/* ${DISABLE_COMMENT} */}` },
    ]),
  ].sort((a, b) => b.pos - a.pos)

  let code = source
  for (const { pos, text } of edits) {
    code = code.slice(0, pos) + text + code.slice(pos)
  }

  return { code, changed: true }
}

// ─── File collection ─────────────────────────────────────────────────────────

async function collectFiles() {
  const files = []
  for await (const entry of glob(pattern, {
    cwd: resolve(import.meta.dirname, '..'),
    absolute: true,
  })) {
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

    // Fast pre-check — skip files with no target elements at all.
    if (!/<(?:span|p|code|label|h[1-6])[\s/>]/.test(source)) {
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
