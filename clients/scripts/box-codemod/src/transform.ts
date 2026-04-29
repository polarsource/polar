import jscodeshift, {
  type API,
  type FileInfo,
  type JSXAttribute,
  type JSXElement,
} from 'jscodeshift'
import { mapSingle, tryColorPair, type MapResult } from './mappings.ts'
import { parseClasses } from './parse-classes.ts'
import type { ElementReport, ParsedClass } from './types.ts'

const BOX_TAGS = new Set([
  'div',
  'span',
  'section',
  'article',
  'aside',
  'main',
  'nav',
  'header',
  'footer',
  'form',
  'fieldset',
  'label',
  'ul',
  'ol',
  'li',
])

export interface TransformResult {
  source: string | null
  reports: ElementReport[]
}

export function runTransform(file: FileInfo): TransformResult {
  const j = jscodeshift.withParser('tsx')
  const root = j(file.source)
  const reports: ElementReport[] = []
  let touched = false

  root.find(j.JSXElement).forEach((path) => {
    const el = path.node
    if (el.openingElement.name.type !== 'JSXIdentifier') return
    const tagName = el.openingElement.name.name
    if (!BOX_TAGS.has(tagName)) return

    // Spread attributes (e.g. {...props}, {...getRootProps()}) often carry
    // typed HTML element props (Ref<HTMLDivElement>, color: string, etc.)
    // that conflict with Box's stricter prop types. Skip these elements.
    const hasSpread = (el.openingElement.attributes ?? []).some(
      (a) => a.type === 'JSXSpreadAttribute',
    )
    if (hasSpread) {
      reports.push({
        file: file.path,
        line: el.loc?.start.line ?? 0,
        status: 'skipped',
        reason:
          'spread attribute (e.g. {...props}) — typed HTML props would conflict with Box',
      })
      return
    }

    const classNameAttr = findClassNameAttr(el)
    const report: ElementReport = {
      file: file.path,
      line: el.loc?.start.line ?? 0,
      status: 'converted',
    }

    let result: ConvertResult = { props: new Map(), leftover: [] }
    let dynamicClassName = false

    if (classNameAttr) {
      const classNameValue = extractStaticClassName(classNameAttr)
      if (classNameValue === null) {
        // Dynamic className — still convert the tag, leave className expression intact.
        dynamicClassName = true
        report.reason = 'dynamic className kept as-is'
      } else if (classNameValue.trim() !== '') {
        result = convertClassName(classNameValue, report)
      }
    }

    applyConversion(j, el, tagName, classNameAttr, result, dynamicClassName)
    if (dynamicClassName || result.leftover.length > 0) {
      report.status = 'partial'
      if (result.leftover.length > 0) report.leftover = result.leftover
    }
    reports.push(report)
    touched = true
  })

  if (!touched) return { source: null, reports }

  ensureBoxImport(j, root)
  return { source: root.toSource({ quote: 'double' }), reports }
}

function findClassNameAttr(el: JSXElement): JSXAttribute | null {
  for (const attr of el.openingElement.attributes ?? []) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'className'
    ) {
      return attr
    }
  }
  return null
}

function extractStaticClassName(attr: JSXAttribute): string | null {
  const v = attr.value
  if (!v) return null
  if (v.type === 'StringLiteral' || v.type === 'Literal') {
    return typeof v.value === 'string' ? v.value : null
  }
  if (v.type === 'JSXExpressionContainer') {
    const expr = v.expression
    if (expr.type === 'StringLiteral' || expr.type === 'Literal') {
      return typeof expr.value === 'string' ? expr.value : null
    }
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      return expr.quasis[0].value.cooked ?? null
    }
  }
  return null
}

interface ConvertResult {
  props: Map<string, MapResult[]>
  leftover: string[]
}

function convertClassName(raw: string, report: ElementReport): ConvertResult {
  const parsed = parseClasses(raw)
  const props = new Map<string, MapResult[]>()
  const consumed = new Set<ParsedClass>()

  // Color pairs first (they consume two classes)
  for (const pair of tryColorPair(parsed)) {
    const list = props.get(pair.mapped.prop) ?? []
    list.push(pair.mapped)
    props.set(pair.mapped.prop, list)
    pair.consumed.forEach((c) => consumed.add(c))
  }

  for (const cls of parsed) {
    if (consumed.has(cls)) continue
    const ms = mapSingle(cls, report)
    if (!ms) continue
    for (const m of ms) {
      const list = props.get(m.prop) ?? []
      list.push(m)
      props.set(m.prop, list)
    }
    consumed.add(cls)
  }

  const leftover = parsed.filter((c) => !consumed.has(c)).map((c) => c.raw)
  return { props, leftover }
}

function applyConversion(
  j: API['jscodeshift'],
  el: JSXElement,
  tagName: string,
  classNameAttr: JSXAttribute | null,
  result: ConvertResult,
  keepDynamicClassName: boolean,
): void {
  const newAttrs: JSXAttribute[] = []

  if (tagName !== 'div') {
    newAttrs.push(j.jsxAttribute(j.jsxIdentifier('as'), j.literal(tagName)))
  }

  for (const [prop, mappings] of result.props) {
    newAttrs.push(buildPropAttr(j, prop, mappings))
  }

  // Drop the original className (we'll re-add it below if needed)
  const otherAttrs = (el.openingElement.attributes ?? []).filter(
    (a) => a !== classNameAttr,
  )

  const finalAttrs = [...newAttrs, ...otherAttrs]
  if (keepDynamicClassName && classNameAttr) {
    finalAttrs.push(classNameAttr)
  } else if (result.leftover.length > 0) {
    finalAttrs.push(
      j.jsxAttribute(
        j.jsxIdentifier('className'),
        j.literal(result.leftover.join(' ')),
      ),
    )
  }

  el.openingElement.name = j.jsxIdentifier('Box')
  el.openingElement.attributes = finalAttrs
  if (el.closingElement) {
    el.closingElement.name = j.jsxIdentifier('Box')
  }
}

function buildPropAttr(
  j: API['jscodeshift'],
  prop: string,
  mappings: MapResult[],
): JSXAttribute {
  // If single mapping with no bp/state, render as scalar
  if (mappings.length === 1 && !mappings[0].bp && !mappings[0].state) {
    return j.jsxAttribute(
      j.jsxIdentifier(prop),
      literalOrExpr(j, mappings[0].value),
    )
  }
  // Build object expression { base, sm, hover, ... }
  const props: Record<string, unknown> = {}
  for (const m of mappings) {
    const key = m.bp ?? m.state ?? 'base'
    props[key] = m.value
  }
  const obj = j.objectExpression(
    Object.entries(props).map(([k, v]) =>
      j.property('init', j.identifier(quoteKey(k)), valueLiteral(j, v)),
    ),
  )
  return j.jsxAttribute(j.jsxIdentifier(prop), j.jsxExpressionContainer(obj))
}

function quoteKey(k: string): string {
  return k
}

function literalOrExpr(
  j: API['jscodeshift'],
  v: unknown,
): JSXAttribute['value'] {
  if (typeof v === 'string') return j.literal(v)
  if (typeof v === 'number') {
    return j.jsxExpressionContainer(j.literal(v))
  }
  return j.jsxExpressionContainer(valueLiteral(j, v))
}

function valueLiteral(j: API['jscodeshift'], v: unknown) {
  if (typeof v === 'string') return j.literal(v)
  if (typeof v === 'number') return j.literal(v)
  return j.literal(String(v))
}

function ensureBoxImport(
  j: API['jscodeshift'],
  root: ReturnType<typeof jscodeshift>,
): void {
  const existing = root.find(j.ImportDeclaration, {
    source: { value: '@polar-sh/orbit/Box' },
  })
  if (existing.size() > 0) return

  const newImport = j.importDeclaration(
    [j.importSpecifier(j.identifier('Box'))],
    j.literal('@polar-sh/orbit/Box'),
  )
  const firstImport = root.find(j.ImportDeclaration).at(0)
  if (firstImport.size() > 0) {
    firstImport.insertBefore(newImport)
  } else {
    root.get().node.program.body.unshift(newImport)
  }
}
