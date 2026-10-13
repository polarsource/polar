import config from './polar.config'

interface Context {
  readonly context?: { readonly isOptional?: boolean }
}

interface Property {
  readonly name: PropertyKey
  readonly type: AST
}

type AST = Context &
  (
    | { readonly _tag: 'Suspend'; readonly thunk: () => AST }
    | { readonly _tag: 'Literal'; readonly literal: unknown }
    | { readonly _tag: 'Union'; readonly types: ReadonlyArray<AST> }
    | { readonly _tag: 'Arrays'; readonly rest: ReadonlyArray<AST> }
    | {
        readonly _tag: 'Objects'
        readonly propertySignatures: ReadonlyArray<Property>
      }
    | { readonly _tag: 'Null' | 'String' | 'Number' | 'Boolean' }
  )

const NOT_ACCEPTED_BY_THE_API = [
  'config.products[].trial_interval',
  'config.products[].trial_interval_count',
]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isOptional = (ast: AST) => ast.context?.isOptional === true

const resolve = (ast: AST): AST =>
  ast._tag === 'Suspend' ? resolve(ast.thunk()) : ast

const isEnum = (ast: AST): boolean => {
  const node = resolve(ast)
  return (
    node._tag === 'Literal' ||
    (node._tag === 'Union' && node.types.every(isEnum))
  )
}

const isPrimitive = (ast: AST) =>
  ['String', 'Number', 'Boolean'].includes(resolve(ast)._tag)

const matches = (ast: AST, value: unknown): boolean => {
  const node = resolve(ast)
  switch (node._tag) {
    case 'Literal':
      return value === node.literal
    case 'Null':
      return value === null
    case 'String':
      return typeof value === 'string'
    case 'Number':
      return typeof value === 'number'
    case 'Boolean':
      return typeof value === 'boolean'
    case 'Arrays':
      return Array.isArray(value)
    case 'Union':
      return node.types.some((member) => matches(member, value))
    case 'Objects':
      return (
        isObject(value) &&
        node.propertySignatures.every((property) => {
          const field = value[String(property.name)]
          return field === undefined
            ? isOptional(property.type)
            : matches(property.type, field)
        })
      )
    default:
      return true
  }
}

const literalsOf = (ast: AST): unknown[] => {
  const node = resolve(ast)
  if (node._tag === 'Literal') return [node.literal]
  return node._tag === 'Union' ? node.types.flatMap(literalsOf) : []
}

const variant = (ast: AST): string => {
  const node = resolve(ast)
  if (node._tag === 'Null') return 'null'
  if (node._tag !== 'Objects') return node._tag.toLowerCase()
  const tags = node.propertySignatures.flatMap((property) =>
    isEnum(property.type)
      ? [
          `${String(property.name)}: ${literalsOf(property.type)
            .map((literal) => JSON.stringify(literal))
            .join(' | ')}`,
        ]
      : [],
  )
  return tags.length > 0
    ? `{ ${tags.join(', ')} }`
    : `{ ${node.propertySignatures
        .filter((property) => !isOptional(property.type))
        .map((property) => String(property.name))
        .join(', ')} }`
}

const missingFeatures = (schema: AST, value: unknown) => {
  const covered = new Set<string>()
  const absent = new Set<string>()
  const note = (feature: string, present: boolean) =>
    (present ? covered : absent).add(feature.replace(/(\.\w+\[\])\1+/g, '$1'))

  const walk = (ast: AST, values: unknown[], path: string): void => {
    const node = resolve(ast)
    if (values.length === 0) return
    switch (node._tag) {
      case 'Objects':
        for (const property of node.propertySignatures) {
          const field = `${path}.${String(property.name)}`
          const present = values
            .filter(isObject)
            .map((item) => item[String(property.name)])
            .filter((item) => item !== undefined)
          note(field, present.length > 0)
          walk(property.type, present, field)
        }
        return
      case 'Arrays':
        for (const element of node.rest) {
          walk(
            element,
            values.flatMap((item) => (Array.isArray(item) ? item : [])),
            `${path}[]`,
          )
        }
        return
      case 'Union':
        if (isEnum(node)) return
        for (const member of node.types) {
          if (isPrimitive(member)) continue
          const matched = values.filter((item) => matches(member, item))
          note(`${path} as ${variant(member)}`, matched.length > 0)
          walk(member, matched, path)
        }
        return
      case 'Boolean':
        for (const flag of [true, false]) {
          note(`${path} = ${flag}`, values.includes(flag))
        }
        return
      default:
        return
    }
  }

  walk(schema, [value], 'config')
  return [...absent].filter((feature) => !covered.has(feature))
}

const source = new URL(
  '../../packages/polar/src/schema/config.ts',
  import.meta.url,
).href
const { PolarConfig } = (await import(source)) as {
  readonly PolarConfig: { readonly ast: AST }
}

const missing = missingFeatures(PolarConfig.ast, config.toJSON())
const unused = missing.filter(
  (feature) => !NOT_ACCEPTED_BY_THE_API.includes(feature),
)
const accepted = NOT_ACCEPTED_BY_THE_API.filter(
  (feature) => !missing.includes(feature),
)

if (unused.length > 0 || accepted.length > 0) {
  console.error(
    [
      ...(unused.length > 0
        ? ['polar.config.ts does not use:', ...unused.map((f) => `  ${f}`)]
        : []),
      ...(accepted.length > 0
        ? [
            'polar.config.ts now uses, so remove from NOT_ACCEPTED_BY_THE_API:',
            ...accepted.map((f) => `  ${f}`),
          ]
        : []),
    ].join('\n'),
  )
  process.exit(1)
}

console.log('polar.config.ts uses every config feature')
