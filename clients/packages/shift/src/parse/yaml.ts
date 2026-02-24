import { Effect, Data } from 'effect'
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { Schema } from 'effect'
import { RawToken, TokenDocumentSchema } from './schema.js'
import type { RawToken as RawTokenType, TokenDocument, TokenGroup, TokenType } from '../types.js'

export class ParseError extends Data.TaggedError('ParseError')<{
  file: string
  cause: unknown
}> {}

const RAW_TOKEN_KEYS = new Set([
  'value',
  'type',
  'category',
  'description',
  'themes',
  'breakpoints',
])

const DOCUMENT_KEYS = new Set(['props', 'imports', 'global'])
const ALIAS_STRING_RE = /^\{[^}]+\}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateCategoryValue(category: string, path: string[]): void {
  if (/[A-Z]/.test(category)) {
    throw new Error(
      `Invalid category at "${path.join('.')}". ` +
        'Category values must be lowercase (no uppercase letters).',
    )
  }
}

function isRawToken(value: unknown): value is RawTokenType {
  return (
    isObject(value) &&
    'value' in value &&
    (typeof value.value === 'string' ||
      typeof value.value === 'number' ||
      isObject(value.value))
  )
}

function validateColorValueObject(value: unknown, path: string[]): void {
  if (!isObject(value)) return
  const hasHexKey = 'hex' in value
  const hasColorSpaceKey = 'colorSpace' in value
  const hasComponentsKey = 'components' in value
  if (!hasHexKey && !hasColorSpaceKey && !hasComponentsKey) return

  const hasHex = typeof value.hex === 'string'
  const hasColorSpace = hasColorSpaceKey
  const hasComponents = hasComponentsKey

  if (hasHex && (hasColorSpace || hasComponents)) {
    throw new Error(
      `Invalid color value at "${path.join('.')}". ` +
        'Use either { hex } or { colorSpace, components }, not both.',
    )
  }

  if (hasColorSpace !== hasComponents) {
    throw new Error(
      `Invalid color value at "${path.join('.')}". ` +
        'colorSpace and components must be provided together.',
    )
  }

  if (!hasHex && !(hasColorSpace && hasComponents)) {
    throw new Error(
      `Invalid color value at "${path.join('.')}". ` +
        'Use either { hex } or { colorSpace, components }.',
    )
  }
}

function isDimensionObject(value: unknown): value is { value: number; unit: string } {
  return (
    isObject(value) &&
    typeof value.value === 'number' &&
    typeof value.unit === 'string'
  )
}

function isDimensionAliasOrExpression(value: string): boolean {
  const trimmed = value.trim()
  return ALIAS_STRING_RE.test(trimmed) || /[+\-*/()]/.test(trimmed)
}

function validateDimensionValue(value: unknown, path: string[]): void {
  if (isDimensionObject(value)) return
  if (typeof value === 'string' && isDimensionAliasOrExpression(value)) return

  throw new Error(
    `Invalid dimension value at "${path.join('.')}". ` +
      'Dimension tokens must use { value: <number>, unit: <string> } for literals.',
  )
}

function validateDimensionToken(token: RawTokenType, path: string[]): void {
  if (token.type !== 'dimension') return
  validateDimensionValue(token.value, [...path, 'value'])

  if (token.themes) {
    for (const [theme, themeValue] of Object.entries(token.themes)) {
      validateDimensionValue(themeValue, [...path, 'themes', theme])
    }
  }
  if (token.breakpoints) {
    for (const [breakpoint, breakpointValue] of Object.entries(token.breakpoints)) {
      validateDimensionValue(breakpointValue, [...path, 'breakpoints', breakpoint])
    }
  }
}

function decodeRawToken(value: unknown, path: string[]): RawTokenType {
  let decoded: RawTokenType
  try {
    decoded = Schema.decodeUnknownSync(RawToken)(value) as RawTokenType
  } catch (error) {
    throw new Error(`Invalid token at "${path.join('.')}": ${String(error)}`)
  }

  const raw = value as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!RAW_TOKEN_KEYS.has(key)) {
      throw new Error(
        `Unexpected token property "${key}" at "${path.join('.')}". ` +
          'Allowed properties: value, type, category, description, themes, breakpoints.',
      )
    }
  }

  if (typeof raw.category === 'string') {
    validateCategoryValue(raw.category, [...path, 'category'])
  }

  validateColorValueObject(raw.value, [...path, 'value'])
  if (isObject(raw.themes)) {
    for (const [theme, themeValue] of Object.entries(raw.themes)) {
      validateColorValueObject(themeValue, [...path, 'themes', theme])
    }
  }
  if (isObject(raw.breakpoints)) {
    for (const [breakpoint, breakpointValue] of Object.entries(raw.breakpoints)) {
      validateColorValueObject(breakpointValue, [...path, 'breakpoints', breakpoint])
    }
  }

  return decoded
}

function deepMergeGroups(base: TokenGroup, override: TokenGroup): TokenGroup {
  return { ...base, ...override }
}

function applyGlobalDefaults(group: TokenGroup, docGlobal?: TokenDocument['global']): TokenGroup {
  const out: TokenGroup = {}
  for (const [key, value] of Object.entries(group)) {
    if (!isRawToken(value)) {
      throw new Error(
        `Invalid token definition at "${key}". ` +
          'Directly under props, each entry must be a token definition object.',
      )
    }

    const token: RawTokenType = {
      ...value,
      type: value.type ?? docGlobal?.type,
      category: value.category ?? docGlobal?.category,
    }
    validateDimensionToken(token, ['props', key])
    out[key] = token
  }
  return out
}

function validateTokenLeaf(node: unknown, path: string[]): RawTokenType {
  if (!isObject(node)) {
    throw new Error(`Invalid token at "${path.join('.')}": expected token object`)
  }

  if (!isRawToken(node)) {
    throw new Error(
      `Invalid token at "${path.join('.')}". ` +
        'Grouped token definitions are not allowed under props.',
    )
  }
  return decodeRawToken(node, path)
}

function validatePropsNode(node: unknown, path: string[]): TokenGroup {
  if (!isObject(node)) {
    throw new Error(`Invalid "${path.join('.')}": expected object`)
  }

  const props: TokenGroup = {}
  for (const [key, value] of Object.entries(node)) {
    props[key] = validateTokenLeaf(value, [...path, key])
  }
  return props
}

function parseTokenDocument(content: string, file: string): TokenDocument {
  const parsed = parseYaml(content)
  if (!isObject(parsed)) {
    throw new Error('YAML root must be an object')
  }

  for (const key of Object.keys(parsed)) {
    if (!DOCUMENT_KEYS.has(key)) {
      throw new Error(
        `Unexpected top-level property "${key}" in "${file}". ` +
          'Allowed properties: props, imports, global.',
      )
    }
  }

  if (!('props' in parsed)) {
    throw new Error(`Missing required top-level property "props" in "${file}"`)
  }
  if (!('imports' in parsed)) {
    throw new Error(`Missing required top-level property "imports" in "${file}"`)
  }

  let decodedDoc: TokenDocument
  try {
    decodedDoc = Schema.decodeUnknownSync(TokenDocumentSchema)(parsed) as TokenDocument
  } catch (error) {
    throw new Error(`Invalid document schema in "${file}": ${String(error)}`)
  }

  for (const p of decodedDoc.imports) {
    if (typeof p !== 'string') {
      throw new Error(`"imports" entries must be strings in "${file}"`)
    }
    if (isAbsolute(p)) {
      throw new Error(`"imports" entries must be relative paths in "${file}": "${p}"`)
    }
  }

  const props = validatePropsNode(decodedDoc.props, ['props'])

  let docGlobal: TokenDocument['global']
  if (decodedDoc.global !== undefined) {
    if (!isObject(decodedDoc.global)) {
      throw new Error(`"global" must be an object in "${file}"`)
    }
    for (const key of Object.keys(decodedDoc.global)) {
      if (key !== 'type' && key !== 'category') {
        throw new Error(
          `Unexpected "global" property "${key}" in "${file}". Allowed: type, category.`,
        )
      }
    }
    if (typeof decodedDoc.global.category === 'string') {
      validateCategoryValue(decodedDoc.global.category, ['global', 'category'])
    }
    docGlobal = {
      type:
        typeof decodedDoc.global.type === 'string'
          ? (decodedDoc.global.type as TokenType)
          : undefined,
      category: typeof decodedDoc.global.category === 'string' ? decodedDoc.global.category : undefined,
    }
  }

  return {
    props,
    imports: decodedDoc.imports,
    global: docGlobal,
  }
}

function loadTokenGroup(file: string, stack = new Set<string>()): TokenGroup {
  const absoluteFile = resolve(file)
  if (stack.has(absoluteFile)) {
    throw new Error(`Circular import detected: ${[...stack, absoluteFile].join(' -> ')}`)
  }

  const nextStack = new Set(stack)
  nextStack.add(absoluteFile)

  const content = readFileSync(absoluteFile, 'utf-8')
  const doc = parseTokenDocument(content, absoluteFile)

  let mergedImports: TokenGroup = {}
  const baseDir = dirname(absoluteFile)
  for (const importPath of doc.imports) {
    const importedFile = resolve(baseDir, importPath)
    const imported = loadTokenGroup(importedFile, nextStack)
    mergedImports = deepMergeGroups(mergedImports, imported)
  }

  const localProps = applyGlobalDefaults(doc.props, doc.global)
  return deepMergeGroups(mergedImports, localProps)
}

export const parseYamlFile = (file: string): Effect.Effect<TokenGroup, ParseError> =>
  Effect.try({
    try: () => loadTokenGroup(file),
    catch: (cause) => new ParseError({ file, cause }),
  })
