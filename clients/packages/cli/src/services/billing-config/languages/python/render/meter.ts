import { Effect, Schema } from 'effect'
import { attributeNames } from '@/services/billing-config/languages/python/render/attributes'
import {
  condition,
  eventsAndWhere,
  FILTER_HELPERS,
  Group,
} from '@/services/billing-config/languages/python/render/filter'
import {
  classBlock,
  entry,
  keyword,
  literal,
  type Node,
  option,
} from '@/services/billing-config/languages/python/render/syntax'

const AGGREGATES = {
  sum: 'Sum',
  max: 'Max',
  min: 'Min',
  avg: 'Avg',
  unique: 'Unique',
}

const HELPERS = ['Meter', ...FILTER_HELPERS, ...Object.values(AGGREGATES)]

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
  attribute: string,
  imports: Set<string>,
): ReadonlyArray<Node> => {
  const { events, where } = eventsAndWhere(meter.filter)
  const [event] = events
  const entries = Object.entries(meter.metadata ?? {}).map(
    ([key, value]) => `${literal(key)}: ${literal(value)}`,
  )
  return [
    literal(meter.name),
    ...option(
      'on',
      events.length > 1
        ? `[${events.map(literal).join(', ')}]`
        : event && literal(event),
    ),
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

export const meterSet = (input: unknown, imports: Set<string>) =>
  Effect.gen(function* () {
    const meters = yield* decodeMeters(input)
    imports.add('MeterSet')
    if (meters.length > 0) imports.add('Meter')
    const attributes = attributeNames(
      meters.map((meter) => meter.external_id),
      'meter',
      HELPERS,
    )
    return classBlock(
      'Meters',
      'MeterSet',
      meters.map((meter, index) =>
        entry(
          attributes[index]!,
          'Meter',
          meterArguments(meter, attributes[index]!, imports),
        ),
      ),
    )
  })
