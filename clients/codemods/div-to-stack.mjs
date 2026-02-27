#!/usr/bin/env node
/**
 * Codemod: replace flex <div> elements with <Stack /> from @polar-sh/orbit
 *
 * Handles:
 *   flex-col / flex-row             → vertical / horizontal
 *   flex-col xl:flex-row            → verticalUntil="xl"
 *   flex-row xl:flex-col            → horizontalUntil="xl"
 *   items-*, justify-*, flex-wrap   → alignItems, justifyContent, flexWrap
 *                                     (with responsive { default: 'x', xl: 'y' } variants)
 *   gap-N, gap-x-N, gap-y-N        → gap, horizontalGap, verticalGap
 *   flex-1, flex-auto, grow, shrink → flex child props
 *
 * Only processes divs where className is a plain string literal (or {"…"}).
 * Complex classNames (cn(), template literals) are left unchanged.
 *
 * Usage:
 *   node codemods/div-to-stack.mjs [--dry-run] [glob]
 *
 * Examples:
 *   node codemods/div-to-stack.mjs --dry-run
 *   node codemods/div-to-stack.mjs 'apps/web/src/app/(main)/dashboard/**\/*.tsx'
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { createRequire } from 'node:module'
import { glob } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const ts = require('../apps/web/node_modules/typescript/lib/typescript.js')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const patternArg = args.find((a) => !a.startsWith('--'))
const pattern = patternArg ?? 'apps/web/src/**/*.tsx'

// ─── Tailwind class → Stack prop tables ──────────────────────────────────────

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl']

const ITEMS_MAP = {
  'items-start': 'start',
  'items-end': 'end',
  'items-center': 'center',
  'items-stretch': 'stretch',
  'items-baseline': 'baseline',
}

const JUSTIFY_MAP = {
  'justify-start': 'start',
  'justify-end': 'end',
  'justify-center': 'center',
  'justify-between': 'between',
  'justify-around': 'around',
  'justify-evenly': 'evenly',
}

const FLEX_WRAP_MAP = {
  'flex-wrap': 'wrap',
  'flex-nowrap': 'nowrap',
  'flex-wrap-reverse': 'wrap-reverse',
}

const DIRECTION_MAP = {
  'flex-row': 'row',
  'flex-col': 'column',
  'flex-row-reverse': 'row-reverse',
  'flex-col-reverse': 'column-reverse',
}

// Reverse lookup: direction value → tailwind class
const DIRECTION_TO_TW = Object.fromEntries(
  Object.entries(DIRECTION_MAP).map(([k, v]) => [v, k]),
)

const FLEX_CHILD_MAP = {
  'flex-1': { prop: 'flex', val: '1' },
  'flex-auto': { prop: 'flex', val: 'auto' },
  'flex-none': { prop: 'flex', val: 'none' },
  'flex-initial': { prop: 'flex', val: 'initial' },
  grow: { prop: 'flexGrow', val: '1' },
  'grow-0': { prop: 'flexGrow', val: '0' },
  shrink: { prop: 'flexShrink', val: '1' },
  'shrink-0': { prop: 'flexShrink', val: '0' },
}

const VALID_GAPS = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
  44, 48,
])

// ─── Class parser ─────────────────────────────────────────────────────────────

/**
 * Parse a Tailwind class string and extract Stack-compatible flex classes.
 *
 * Returns null if no `flex` base class is present.
 * Returns a parsed descriptor otherwise.
 */
function parseFlexClasses(classString) {
  const classes = classString.trim().split(/\s+/).filter(Boolean)
  const remaining = []

  let hasFlex = false
  let hasHidden = false     // bare `hidden` class present
  let flexBreakpoint = null // bp of a breakpoint-prefixed `flex` class
  const directions = {}     // bp → 'row' | 'column' | ...
  const alignItems = {}     // bp → Stack alignItems value
  const justifyContent = {} // bp → Stack justifyContent value
  const flexWrap = {}       // bp → Stack flexWrap value
  const flexChild = {}      // bp → flex shorthand value ('1', 'auto', ...)
  let flexGrow = null
  let flexShrink = null
  let gap = null
  let horizontalGap = null
  let verticalGap = null

  for (const cls of classes) {
    // Split off optional breakpoint prefix
    let bp = 'default'
    let base = cls
    for (const breakpoint of BREAKPOINTS) {
      if (cls.startsWith(breakpoint + ':')) {
        bp = breakpoint
        base = cls.slice(breakpoint.length + 1)
        break
      }
    }

    if (base === 'flex') {
      hasFlex = true
      if (bp !== 'default') flexBreakpoint = bp
      continue
    }

    if (base === 'hidden' && bp === 'default') {
      hasHidden = true
      continue
    }

    if (DIRECTION_MAP[base] !== undefined) {
      directions[bp] = DIRECTION_MAP[base]
      continue
    }

    if (ITEMS_MAP[base] !== undefined) {
      alignItems[bp] = ITEMS_MAP[base]
      continue
    }

    if (JUSTIFY_MAP[base] !== undefined) {
      justifyContent[bp] = JUSTIFY_MAP[base]
      continue
    }

    if (FLEX_WRAP_MAP[base] !== undefined) {
      flexWrap[bp] = FLEX_WRAP_MAP[base]
      continue
    }

    // flex child shortcuts (non-responsive only)
    if (FLEX_CHILD_MAP[base] !== undefined && bp === 'default') {
      const { prop, val } = FLEX_CHILD_MAP[base]
      if (prop === 'flex') flexChild.default = val
      else if (prop === 'flexGrow') flexGrow = val
      else if (prop === 'flexShrink') flexShrink = val
      continue
    }

    // gap utilities — Stack gap props are not Responsive, so default bp only
    if (bp === 'default') {
      const gapM = base.match(/^gap-(\d+)$/)
      if (gapM) {
        const n = parseInt(gapM[1], 10)
        if (VALID_GAPS.has(n)) { gap = n; continue }
      }
      const gapXM = base.match(/^gap-x-(\d+)$/)
      if (gapXM) {
        const n = parseInt(gapXM[1], 10)
        if (VALID_GAPS.has(n)) { horizontalGap = n; continue }
      }
      const gapYM = base.match(/^gap-y-(\d+)$/)
      if (gapYM) {
        const n = parseInt(gapYM[1], 10)
        if (VALID_GAPS.has(n)) { verticalGap = n; continue }
      }
    }

    remaining.push(cls)
  }

  if (!hasFlex) return null

  // ─── Resolve flex-direction → Stack direction prop ───────────────────────

  let direction = null
  const dirKeys = Object.keys(directions)

  if (dirKeys.length === 0) {
    // No explicit direction → Stack default (row), nothing needed
  } else if (dirKeys.length === 1 && dirKeys[0] === 'default') {
    const dir = directions.default
    if (dir === 'column') direction = 'vertical'
    else if (dir === 'row') direction = 'horizontal'
    else {
      // row-reverse / col-reverse — no Stack equivalent, keep in className
      remaining.unshift(DIRECTION_TO_TW[dir])
    }
  } else if (dirKeys.length === 2 && dirKeys.includes('default')) {
    const bp = dirKeys.find((k) => k !== 'default')
    const def = directions.default
    const bpDir = directions[bp]
    if (def === 'column' && bpDir === 'row') {
      direction = { verticalUntil: bp }
    } else if (def === 'row' && bpDir === 'column') {
      direction = { horizontalUntil: bp }
    } else {
      // Two directions but not the simple flip pattern — keep in className
      for (const [k, v] of Object.entries(directions)) {
        const tw = DIRECTION_TO_TW[v]
        remaining.unshift(k === 'default' ? tw : `${k}:${tw}`)
      }
    }
  } else {
    // Three or more direction breakpoints — too complex, keep all in className
    for (const [k, v] of Object.entries(directions)) {
      const tw = DIRECTION_TO_TW[v]
      if (tw) remaining.unshift(k === 'default' ? tw : `${k}:${tw}`)
    }
  }

  // hidden + {bp}:flex → hiddenUntil="{bp}"
  const hiddenUntil = hasHidden && flexBreakpoint ? flexBreakpoint : null

  return {
    direction,
    hiddenUntil,
    alignItems: Object.keys(alignItems).length ? alignItems : null,
    justifyContent: Object.keys(justifyContent).length ? justifyContent : null,
    flexWrap: Object.keys(flexWrap).length ? flexWrap : null,
    flex: Object.keys(flexChild).length ? flexChild : null,
    flexGrow,
    flexShrink,
    gap,
    horizontalGap,
    verticalGap,
    remainingClasses: remaining,
  }
}

// ─── Prop serialization ───────────────────────────────────────────────────────

/**
 * Serialize a bp→value map to a JSX attribute value token.
 *   { default: 'center' }           → `"center"`
 *   { default: 'start', xl: 'center' } → `{{ default: 'start', xl: 'center' }}`
 */
function serializeResponsive(obj) {
  const entries = Object.entries(obj)
  if (entries.length === 1 && entries[0][0] === 'default') {
    return `"${entries[0][1]}"`
  }
  const inner = entries.map(([k, v]) => `${k}: '${v}'`).join(', ')
  return `{{ ${inner} }}`
}

/**
 * Build the JSX props string to insert on the <Stack> element.
 * e.g. `vertical gap={4} alignItems="center"`
 */
function buildStackPropsStr(parsed) {
  const parts = []
  const {
    direction,
    hiddenUntil,
    alignItems,
    justifyContent,
    flexWrap,
    flex,
    flexGrow,
    flexShrink,
    gap,
    horizontalGap,
    verticalGap,
  } = parsed

  // Visibility
  if (hiddenUntil) parts.push(`hiddenUntil="${hiddenUntil}"`)

  // Direction
  if (direction === 'vertical') parts.push('vertical')
  else if (direction === 'horizontal') parts.push('horizontal')
  else if (direction?.verticalUntil) parts.push(`verticalUntil="${direction.verticalUntil}"`)
  else if (direction?.horizontalUntil) parts.push(`horizontalUntil="${direction.horizontalUntil}"`)

  // Gap
  if (gap !== null) parts.push(`gap={${gap}}`)
  if (horizontalGap !== null) parts.push(`horizontalGap={${horizontalGap}}`)
  if (verticalGap !== null) parts.push(`verticalGap={${verticalGap}}`)

  // Flex container
  if (alignItems) parts.push(`alignItems=${serializeResponsive(alignItems)}`)
  if (justifyContent) parts.push(`justifyContent=${serializeResponsive(justifyContent)}`)
  if (flexWrap) parts.push(`flexWrap=${serializeResponsive(flexWrap)}`)

  // Flex child
  if (flex) parts.push(`flex=${serializeResponsive(flex)}`)
  if (flexGrow !== null) parts.push(`flexGrow="${flexGrow}"`)
  if (flexShrink !== null) parts.push(`flexShrink="${flexShrink}"`)

  return parts.join(' ')
}

// ─── Core transform ───────────────────────────────────────────────────────────

function transform(source, filePath) {
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  const edits = []
  let needsStackImport = false

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === 'div') {
        const result = tryTransformDiv(node, sf)
        if (result) {
          edits.push(...result.edits)
          needsStackImport = true
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  if (edits.length === 0) return { code: source, changed: false }

  // Apply edits in reverse order so earlier offsets stay valid
  edits.sort((a, b) => b.start - a.start)
  let code = source
  for (const { start, end, replacement } of edits) {
    code = code.slice(0, start) + replacement + code.slice(end)
  }

  if (needsStackImport) code = ensureStackImport(code, filePath)
  return { code, changed: true }
}

function tryTransformDiv(node, sf) {
  // Find className attribute
  let classNameAttr = null
  for (const attr of node.attributes.properties) {
    if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'className') {
      classNameAttr = attr
      break
    }
  }
  if (!classNameAttr) return null

  // Only handle plain string className values
  const init = classNameAttr.initializer
  let classString = null
  if (ts.isStringLiteral(init)) {
    classString = init.text
  } else if (
    ts.isJsxExpression(init) &&
    init.expression &&
    ts.isStringLiteral(init.expression)
  ) {
    classString = init.expression.text
  }
  if (!classString) return null

  const parsed = parseFlexClasses(classString)
  if (!parsed) return null

  const { remainingClasses } = parsed
  const stackPropsStr = buildStackPropsStr(parsed)
  const remainingStr = remainingClasses.join(' ')

  // Build replacement text for the entire className="…" attribute span
  let attrReplacement
  if (stackPropsStr && remainingStr) {
    attrReplacement = `${stackPropsStr} className="${remainingStr}"`
  } else if (stackPropsStr) {
    attrReplacement = stackPropsStr
  } else if (remainingStr) {
    attrReplacement = `className="${remainingStr}"`
  } else {
    attrReplacement = ''
  }

  const edits = []

  // 1. Rename opening tag: div → Stack
  edits.push({
    start: node.tagName.getStart(sf),
    end: node.tagName.getEnd(),
    replacement: 'Stack',
  })

  // 2. Replace className attribute with extracted Stack props (+ remainder)
  edits.push({
    start: classNameAttr.getStart(sf),
    end: classNameAttr.getEnd(),
    replacement: attrReplacement,
  })

  // 3. Rename closing tag for non-self-closing elements
  if (ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)) {
    const closing = node.parent.closingElement
    edits.push({
      start: closing.tagName.getStart(sf),
      end: closing.tagName.getEnd(),
      replacement: 'Stack',
    })
  }

  return { edits }
}

// ─── Import handling ──────────────────────────────────────────────────────────

function ensureStackImport(source, filePath) {
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  let orbitImport = null
  for (const stmt of sf.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === '@polar-sh/orbit'
    ) {
      orbitImport = stmt
      break
    }
  }

  if (orbitImport) {
    const namedBindings = orbitImport.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) return source

    const names = namedBindings.elements.map((el) => el.name.text)
    if (names.includes('Stack')) return source

    const sorted = [...names, 'Stack'].sort()
    const start = namedBindings.getStart(sf)
    const end = namedBindings.getEnd()
    return source.slice(0, start) + `{ ${sorted.join(', ')} }` + source.slice(end)
  }

  // No @polar-sh/orbit import yet — insert after 'use client' / 'use server' directive
  let insertPos = 0
  for (const stmt of sf.statements) {
    if (
      ts.isExpressionStatement(stmt) &&
      ts.isStringLiteral(stmt.expression) &&
      (stmt.expression.text === 'use client' ||
        stmt.expression.text === 'use server')
    ) {
      insertPos = stmt.getEnd()
      if (source[insertPos] === '\n') insertPos++
      break
    }
  }

  return (
    source.slice(0, insertPos) +
    `import { Stack } from '@polar-sh/orbit'\n` +
    source.slice(insertPos)
  )
}

// ─── File collection ──────────────────────────────────────────────────────────

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

    // Fast pre-check — skip files with no flex divs at all
    if (!source.includes('<div') || !source.includes('flex')) {
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
