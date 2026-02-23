#!/usr/bin/env bun
/**
 * Codemod: div-to-orbit
 *
 * Replaces <div> elements with Orbit primitives:
 *   • flex containers  → <Stack>  (extracts alignItems / justifyContent / flexWrap / horizontal)
 *   • everything else  → <Box>
 *
 * Usage (run from clients/):
 *   bun run codemods/div-to-orbit.ts 'apps/web/src/components/Landing/**\/*.tsx'
 */

/// <reference types="bun-types" />

import {
  IndentationText,
  JsxOpeningElement,
  JsxSelfClosingElement,
  Node,
  Project,
  QuoteKind,
  StructureKind,
  type JsxAttributeStructure,
  type SourceFile,
} from 'ts-morph'
import * as path from 'node:path'

// ─── Constants ────────────────────────────────────────────────────────────────

const ORBIT_PACKAGE = '@polar-sh/orbit'
const BREAKPOINT_RE = /^(sm:|md:|lg:|xl:|2xl:)/
const VALID_ALIGN = new Set(['start', 'end', 'center', 'stretch', 'baseline'])
const VALID_JUSTIFY = new Set(['start', 'end', 'center', 'between', 'around', 'evenly'])
const FLEX_CHILD = new Set(['1', 'auto', 'none', 'initial'])

// ─── Analysis ─────────────────────────────────────────────────────────────────

interface Analysis {
  tag: 'Stack' | 'Box'
  horizontal: boolean
  alignItems?: string
  justifyContent?: string
  flexWrap?: string
  flex?: string
  remaining: string[]
}

function analyzeClasses(raw: string): Analysis {
  const classes = raw.trim().split(/\s+/).filter(Boolean)
  const hasFlex = classes.some((c) => c === 'flex' || c === 'inline-flex')

  if (!hasFlex) {
    return { tag: 'Box', horizontal: false, remaining: classes }
  }

  let horizontal = false
  let alignItems: string | undefined
  let justifyContent: string | undefined
  let flexWrap: string | undefined
  let flex: string | undefined
  const remaining: string[] = []

  for (const cls of classes) {
    if (BREAKPOINT_RE.test(cls)) { remaining.push(cls); continue }

    if (cls === 'flex' || cls === 'inline-flex') {
      // consumed — Stack always renders as flex
    } else if (cls === 'flex-row') {
      horizontal = true
    } else if (cls === 'flex-col') {
      // column is Stack's default, silently consumed
    } else if (cls === 'flex-row-reverse' || cls === 'flex-col-reverse') {
      remaining.push(cls) // no direct prop for reverse
    } else if (cls.startsWith('items-')) {
      const v = cls.slice(6)
      VALID_ALIGN.has(v) ? (alignItems = v) : remaining.push(cls)
    } else if (cls.startsWith('justify-')) {
      const v = cls.slice(8)
      VALID_JUSTIFY.has(v) ? (justifyContent = v) : remaining.push(cls)
    } else if (cls === 'flex-wrap') {
      flexWrap = 'wrap'
    } else if (cls === 'flex-nowrap') {
      flexWrap = 'nowrap'
    } else if (cls === 'flex-wrap-reverse') {
      flexWrap = 'wrap-reverse'
    } else if (cls.startsWith('flex-') && FLEX_CHILD.has(cls.slice(5))) {
      flex = cls.slice(5)
    } else {
      remaining.push(cls)
    }
  }

  return { tag: 'Stack', horizontal, alignItems, justifyContent, flexWrap, flex, remaining }
}

// ─── Attribute builders ───────────────────────────────────────────────────────

function stackPropAttrs(a: Analysis): JsxAttributeStructure[] {
  const out: JsxAttributeStructure[] = []
  if (a.horizontal)
    out.push({ kind: StructureKind.JsxAttribute, name: 'horizontal' })
  if (a.alignItems)
    out.push({ kind: StructureKind.JsxAttribute, name: 'alignItems', initializer: `"${a.alignItems}"` })
  if (a.justifyContent)
    out.push({ kind: StructureKind.JsxAttribute, name: 'justifyContent', initializer: `"${a.justifyContent}"` })
  if (a.flexWrap)
    out.push({ kind: StructureKind.JsxAttribute, name: 'flexWrap', initializer: `"${a.flexWrap}"` })
  if (a.flex)
    out.push({ kind: StructureKind.JsxAttribute, name: 'flex', initializer: `"${a.flex}"` })
  return out
}

function buildAttrs(
  analysis: Analysis,
  original: Array<{ name: string; initText: string }>,
): JsxAttributeStructure[] {
  const out: JsxAttributeStructure[] = [...stackPropAttrs(analysis)]

  for (const { name, initText } of original) {
    if (name === 'className') {
      const remainder = analysis.remaining.join(' ')
      if (remainder)
        out.push({ kind: StructureKind.JsxAttribute, name: 'className', initializer: `"${remainder}"` })
      // drop className when all classes were lifted to props
    } else {
      out.push({ kind: StructureKind.JsxAttribute, name, initializer: initText || undefined })
    }
  }

  return out
}

// ─── Import management ────────────────────────────────────────────────────────

function ensureOrbitImports(file: SourceFile, names: Set<string>) {
  const decl = file.getImportDeclarations().find(
    (d) => d.getModuleSpecifierValue() === ORBIT_PACKAGE,
  )
  if (decl) {
    const existing = new Set(decl.getNamedImports().map((n) => n.getName()))
    for (const name of names) {
      if (!existing.has(name)) decl.addNamedImport(name)
    }
  } else {
    file.addImportDeclaration({
      moduleSpecifier: ORBIT_PACKAGE,
      namedImports: [...names].sort(),
    })
  }
}

// ─── Per-element transform ────────────────────────────────────────────────────

function transformElement(
  node: JsxOpeningElement | JsxSelfClosingElement,
): 'Stack' | 'Box' {
  const attrs = node.getAttributes().filter(Node.isJsxAttribute)
  const classAttr = attrs.find((a) => a.getNameNode().getText() === 'className')

  // ── Determine analysis ────────────────────────────────────────────────────
  let analysis: Analysis
  let expressionMode = false

  if (classAttr) {
    const init = classAttr.getInitializer()

    if (init && Node.isStringLiteral(init)) {
      analysis = analyzeClasses(init.getLiteralValue())
    } else if (init && Node.isJsxExpression(init)) {
      expressionMode = true
      const expr = init.getExpression()
      let firstStr: string | null = null

      if (expr && Node.isCallExpression(expr)) {
        const first = expr.getArguments()[0]
        if (first && Node.isStringLiteral(first)) firstStr = first.getLiteralValue()
      }

      analysis = firstStr ? analyzeClasses(firstStr) : { tag: 'Box', horizontal: false, remaining: [] }
    } else {
      analysis = { tag: 'Box', horizontal: false, remaining: [] }
    }
  } else {
    analysis = { tag: 'Box', horizontal: false, remaining: [] }
  }

  const newTag = analysis.tag

  // ── Rename tag ────────────────────────────────────────────────────────────
  node.getTagNameNode().replaceWithText(newTag)

  if (Node.isJsxOpeningElement(node)) {
    const parent = node.getParent()
    if (Node.isJsxElement(parent)) {
      parent.getClosingElement().getTagNameNode().replaceWithText(newTag)
    }
  }

  // ── Rebuild attributes ────────────────────────────────────────────────────
  if (expressionMode && analysis.tag === 'Stack') {
    // Modify the first string arg of the expression to strip lifted classes,
    // then prepend Stack-specific props before existing attrs.
    const classAttrNow = node.getAttributes().filter(Node.isJsxAttribute)
      .find((a) => a.getNameNode().getText() === 'className')
    if (classAttrNow) {
      const init = classAttrNow.getInitializer()
      if (init && Node.isJsxExpression(init)) {
        const expr = init.getExpression()
        if (expr && Node.isCallExpression(expr)) {
          const first = expr.getArguments()[0]
          if (first && Node.isStringLiteral(first)) {
            const remainder = analysis.remaining.join(' ')
            if (remainder) {
              first.replaceWithText(`'${remainder}'`)
            } else {
              // All classes lifted — remove the now-empty first arg only if
              // there are other args remaining (avoids twMerge() with no args)
              if (expr.getArguments().length > 1) first.remove()
            }
          }
        }
      }
    }
    // Prepend Stack props at position 0 (reverse to preserve order)
    const props = stackPropAttrs(analysis)
    for (let i = props.length - 1; i >= 0; i--) {
      node.insertAttribute(0, props[i])
    }
  } else if (!expressionMode) {
    // Full string literal — rebuild all attrs
    const original = attrs.map((a) => ({
      name: a.getNameNode().getText(),
      initText: a.getInitializer()?.getText() ?? '',
    }))

    for (const a of [...node.getAttributes()].reverse()) a.remove()
    for (const a of buildAttrs(analysis, original)) node.addAttribute(a)
  }

  return newTag
}

// ─── File transform ───────────────────────────────────────────────────────────

function transformFile(file: SourceFile): { changed: boolean; stack: number; box: number } {
  let stack = 0
  let box = 0

  // Collect typed div nodes — both opening and self-closing
  type DivNode = JsxOpeningElement | JsxSelfClosingElement
  const divNodes: DivNode[] = []

  file.forEachDescendant((node) => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      if (node.getTagNameNode().getText() === 'div') {
        divNodes.push(node as DivNode)
      }
    }
  })

  if (divNodes.length === 0) return { changed: false, stack, box }

  const needed = new Set<string>()

  // Process in reverse order so edits don't invalidate later node positions
  for (const node of divNodes.reverse()) {
    const tag = transformElement(node)
    needed.add(tag)
    tag === 'Stack' ? stack++ : box++
  }

  ensureOrbitImports(file, needed)
  return { changed: true, stack, box }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const globArg = process.argv[2]
  if (!globArg) {
    console.error('Usage: bun run codemods/div-to-orbit.ts <glob>')
    process.exit(1)
  }

  const root = path.resolve(import.meta.dir, '..')
  const absGlob = path.join(root, globArg)

  const project = new Project({
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
      indentationText: IndentationText.TwoSpaces,
    },
    skipAddingFilesFromTsConfig: true,
  })

  project.addSourceFilesAtPaths(absGlob)
  const files = project.getSourceFiles()

  if (files.length === 0) {
    console.error(`No files matched: ${absGlob}`)
    process.exit(1)
  }

  let totalStack = 0
  let totalBox = 0
  let totalFiles = 0

  for (const file of files) {
    const rel = path.relative(root, file.getFilePath())
    const { changed, stack, box } = transformFile(file)
    if (changed) {
      await file.save()
      console.log(`  ${rel}  (+${stack} Stack, +${box} Box)`)
      totalStack += stack
      totalBox += box
      totalFiles++
    }
  }

  console.log(`\n${totalFiles} files — ${totalStack} <Stack>, ${totalBox} <Box>`)
}

main().catch((e) => { console.error(e); process.exit(1) })
