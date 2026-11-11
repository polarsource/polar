import { Effect, Schema } from 'effect'
import {
  BillingConfigError,
  type ConfigDocument,
} from '@/schemas/BillingConfig'
import { dropOptionalNulls } from '@/services/billing-config/languages/language'

const WIDTH = 88
const INDENT = '    '

const IDENTIFIER = /^(?!__)[A-Za-z_][A-Za-z0-9_]*$/

const RESERVED = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield _entries'.split(
    ' ',
  ),
)

const AGGREGATES = {
  sum: 'Sum',
  max: 'Max',
  min: 'Min',
  avg: 'Avg',
  unique: 'Unique',
}

const Clause = Schema.Struct({
  property: Schema.String,
  operator: Schema.Literals([
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'not_like',
  ]),
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

type Node =
  | string
  | { readonly head: string; readonly args: ReadonlyArray<Node> }

const flat = (node: Node): string =>
  typeof node === 'string'
    ? node
    : `${node.head}(${node.args.map(flat).join(', ')})`

const render = (node: Node, indent: string, suffix = ''): string => {
  const line = `${indent}${flat(node)}${suffix}`
  if (typeof node === 'string' || line.length <= WIDTH) return line
  return [
    `${indent}${node.head}(`,
    ...node.args.map((arg) => render(arg, `${indent}${INDENT}`, ',')),
    `${indent})${suffix}`,
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

const eventAndConditions = ({ conjunction, clauses }: Group) => {
  const [first, ...rest] = clauses
  if (
    conjunction !== 'and' ||
    first === undefined ||
    'conjunction' in first ||
    first.property !== 'name' ||
    first.operator !== 'eq' ||
    typeof first.value !== 'string'
  ) {
    return undefined
  }
  const [only] = rest
  const flattened =
    rest.length === 1 &&
    only !== undefined &&
    'conjunction' in only &&
    only.conjunction === 'and'
  return flattened ? undefined : { event: first.value, conditions: rest }
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

const meterArguments = (
  meter: Meter,
  event: string,
  conditions: ReadonlyArray<Clause | Group>,
  imports: Set<string>,
): ReadonlyArray<Node> => {
  const [only] = conditions
  const where =
    conditions.length > 1
      ? condition({ conjunction: 'and', clauses: conditions }, imports)
      : only && condition(only, imports)
  const entries = Object.entries(meter.metadata ?? {}).map(
    ([key, value]) => `${literal(key)}: ${literal(value)}`,
  )
  return [
    literal(meter.name),
    `on=${literal(event)}`,
    ...(where === undefined ? [] : [keyword('where', where)]),
    ...option('aggregate', aggregateOf(meter.aggregation, imports)),
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
    const meters: Array<string> = []
    for (const meter of yield* decodeMeters(
      dropOptionalNulls(document)['meters'] ?? [],
    )) {
      const parts = eventAndConditions(meter.filter)
      if (
        parts === undefined ||
        !IDENTIFIER.test(meter.external_id) ||
        RESERVED.has(meter.external_id)
      ) {
        return yield* new BillingConfigError({
          message: `The meter ${meter.external_id} has an external ID or a filter that Python cannot express yet.`,
        })
      }
      imports.add('Meter')
      meters.push(
        render(
          {
            head: `${meter.external_id} = Meter`,
            args: meterArguments(meter, parts.event, parts.conditions, imports),
          },
          INDENT,
        ),
      )
    }
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
