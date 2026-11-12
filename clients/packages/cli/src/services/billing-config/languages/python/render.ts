import { Effect, Schema } from 'effect'
import type { ConfigDocument } from '@/schemas/BillingConfig'
import { dropOptionalNulls } from '@/services/billing-config/languages/language'

const WIDTH = 88
const INDENT = '    '

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/

const KEYWORDS =
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  )

const AGGREGATES = {
  sum: 'Sum',
  max: 'Max',
  min: 'Min',
  avg: 'Avg',
  unique: 'Unique',
}

const OPERATORS = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'not_like',
] as const

const HELPERS = [
  'Meter',
  'and_',
  'or_',
  ...OPERATORS,
  ...Object.values(AGGREGATES),
]

const RESERVED = new Set([...KEYWORDS, ...HELPERS])

const Clause = Schema.Struct({
  property: Schema.String,
  operator: Schema.Literals(OPERATORS),
  value: Schema.Union([Schema.String, Schema.Int, Schema.Boolean]),
})
type Clause = typeof Clause.Type

interface Group {
  readonly conjunction: 'and' | 'or'
  readonly clauses: ReadonlyArray<Clause | Group>
}

const Group = Schema.Struct({
  conjunction: Schema.Literals(['and', 'or']),
  clauses: Schema.Array(
    Schema.Union([Clause, Schema.suspend((): Schema.Codec<Group> => Group)]),
  ),
})

const Meter = Schema.Struct({
  external_id: Schema.String,
  name: Schema.String,
  filter: Group,
  aggregation: Schema.Union([
    Schema.Struct({ func: Schema.Literal('count') }),
    Schema.Struct({
      func: Schema.Literals(['sum', 'max', 'min', 'avg', 'unique']),
      property: Schema.String,
    }),
  ]),
  unit: Schema.optionalKey(Schema.Literals(['scalar', 'token', 'custom'])),
  custom_label: Schema.optionalKey(Schema.String),
  custom_multiplier: Schema.optionalKey(Schema.Int),
  metadata: Schema.optionalKey(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]),
    ),
  ),
  deprecated: Schema.optionalKey(Schema.Boolean),
})
type Meter = typeof Meter.Type

const decodeMeters = Schema.decodeUnknownEffect(Schema.Array(Meter), {
  onExcessProperty: 'error',
})

interface Call {
  readonly head: string
  readonly args: ReadonlyArray<Node>
  readonly list?: true
}

type Node = string | Call

const brackets = ({ list }: Call) => (list ? ['[', ']'] : ['(', ')'])

const flat = (node: Node): string => {
  if (typeof node === 'string') return node
  const [open, close] = brackets(node)
  return `${node.head}${open}${node.args.map(flat).join(', ')}${close}`
}

const render = (node: Node, indent: string, suffix = ''): string => {
  const line = `${indent}${flat(node)}${suffix}`
  if (typeof node === 'string' || line.length <= WIDTH) return line
  const [open, close] = brackets(node)
  return [
    `${indent}${node.head}${open}`,
    ...node.args.map((arg) => render(arg, `${indent}${INDENT}`, ',')),
    `${indent}${close}${suffix}`,
  ].join('\n')
}

const literal = (value: string | number | boolean) => {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  const quoted = JSON.stringify(value)
  return typeof value === 'string' &&
    value.includes('"') &&
    !value.includes("'")
    ? `'${quoted.slice(1, -1).replaceAll('\\"', '"')}'`
    : quoted
}

const keyword = (name: string, node: Node): Node =>
  typeof node === 'string'
    ? `${name}=${node}`
    : { ...node, head: `${name}=${node.head}` }

const option = (name: string, value: string | undefined) =>
  value === undefined ? [] : [`${name}=${value}`]

const condition = (input: Clause | Group, imports: Set<string>): Node => {
  if ('conjunction' in input) {
    const head = `${input.conjunction}_`
    imports.add(head)
    return {
      head,
      args: input.clauses.map((clause) => condition(clause, imports)),
    }
  }
  imports.add(input.operator)
  return `${input.operator}(${literal(input.property)}, ${literal(input.value)})`
}

const eventName = (clause: Clause | Group) =>
  !('conjunction' in clause) &&
  clause.property === 'name' &&
  clause.operator === 'eq' &&
  typeof clause.value === 'string'
    ? clause.value
    : undefined

const eventNames = (clause: Clause | Group) => {
  const single = eventName(clause)
  if (single !== undefined) return [single]
  if (
    !('conjunction' in clause) ||
    clause.conjunction !== 'or' ||
    clause.clauses.length < 2
  ) {
    return undefined
  }
  const names = clause.clauses.map(eventName)
  return names.every((name) => name !== undefined) ? names : undefined
}

const isGroup = (clause: Clause | Group | undefined): clause is Group =>
  clause !== undefined && 'conjunction' in clause

const isAnd = (clause: Clause | Group | undefined) =>
  isGroup(clause) && clause.conjunction === 'and'

const eventsAndWhere = (
  filter: Group,
): {
  readonly events: ReadonlyArray<string>
  readonly where: Clause | Group | undefined
} => {
  const every = eventNames(filter)
  if (every !== undefined) return { events: every, where: undefined }
  const [first, ...rest] = filter.clauses
  const [only] = rest
  const events =
    filter.conjunction === 'and' && first !== undefined
      ? eventNames(first)
      : undefined
  if (
    events !== undefined &&
    (events.length === 1 || rest.length > 0) &&
    !(rest.length === 1 && isAnd(only))
  ) {
    return {
      events,
      where: rest.length > 1 ? { conjunction: 'and', clauses: rest } : only,
    }
  }
  const bare =
    filter.conjunction === 'and' &&
    filter.clauses.length === 1 &&
    !isGroup(first)
  return { events: [], where: bare ? first : filter }
}

const usable = (externalId: string) =>
  IDENTIFIER.test(externalId) && !RESERVED.has(externalId)

const attributeNames = (externalIds: ReadonlyArray<string>) => {
  const taken = new Set(externalIds.filter(usable))
  return externalIds.map((externalId) => {
    if (usable(externalId)) return externalId
    const base = externalId.replaceAll(/\W/g, '_').replace(/^_+/, '')
    const name =
      /^[A-Za-z]/.test(base) && !RESERVED.has(base) ? base : `meter_${base}`
    let attribute = name
    for (let count = 2; taken.has(attribute); count++) {
      attribute = `${name}_${count}`
    }
    taken.add(attribute)
    return attribute
  })
}

const aggregateOf = (
  aggregation: Meter['aggregation'],
  imports: Set<string>,
) => {
  if (aggregation.func === 'count') return undefined
  const helper = AGGREGATES[aggregation.func]
  imports.add(helper)
  return `${helper}(${literal(aggregation.property)})`
}

const onArgument = (events: ReadonlyArray<string>): ReadonlyArray<Node> => {
  const [event] = events
  if (event === undefined) return []
  return events.length === 1
    ? [`on=${literal(event)}`]
    : [{ head: 'on=', args: events.map(literal), list: true }]
}

const meterArguments = (
  meter: Meter,
  attribute: string,
  imports: Set<string>,
): ReadonlyArray<Node> => {
  const { events, where } = eventsAndWhere(meter.filter)
  const entries = Object.entries(meter.metadata ?? {}).map(
    ([key, value]) => `${literal(key)}: ${literal(value)}`,
  )
  return [
    literal(meter.name),
    ...onArgument(events),
    ...(where === undefined
      ? []
      : [keyword('where', condition(where, imports))]),
    ...option('aggregate', aggregateOf(meter.aggregation, imports)),
    ...option(
      'external_id',
      attribute === meter.external_id ? undefined : literal(meter.external_id),
    ),
    ...option(
      'unit',
      meter.unit === undefined || meter.unit === 'scalar'
        ? undefined
        : literal(meter.unit),
    ),
    ...option(
      'custom_label',
      meter.custom_label === undefined
        ? undefined
        : literal(meter.custom_label),
    ),
    ...option('custom_multiplier', meter.custom_multiplier?.toString()),
    ...option(
      'metadata',
      entries.length === 0 ? undefined : `{${entries.join(', ')}}`,
    ),
    ...option('deprecated', meter.deprecated ? 'True' : undefined),
  ]
}

const importLine = (names: ReadonlySet<string>) => {
  const sorted = [...names].toSorted(
    (a, b) =>
      Number(/^[a-z]/.test(a)) - Number(/^[a-z]/.test(b)) ||
      (a.toLowerCase() < b.toLowerCase() ? -1 : 1),
  )
  const line = `from polar.config import ${sorted.join(', ')}`
  return line.length <= WIDTH
    ? line
    : [
        'from polar.config import (',
        ...sorted.map((name) => `${INDENT}${name},`),
        ')',
      ].join('\n')
}

export const renderPython = (document: ConfigDocument) =>
  Effect.gen(function* () {
    const imports = new Set(['Config', 'MeterSet'])
    const decoded = yield* decodeMeters(
      dropOptionalNulls(document)['meters'] ?? [],
    )
    if (decoded.length > 0) imports.add('Meter')
    const attributes = attributeNames(decoded.map((meter) => meter.external_id))
    const meters = decoded.map((meter, index) =>
      render(
        {
          head: `${attributes[index]} = Meter`,
          args: meterArguments(meter, attributes[index]!, imports),
        },
        INDENT,
      ),
    )
    return [
      importLine(imports),
      '',
      '',
      'class Meters(MeterSet):',
      ...(meters.length === 0 ? [`${INDENT}pass`] : meters),
      '',
      '',
      'config = Config(meters=Meters)',
      '',
    ].join('\n')
  })
