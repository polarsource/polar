import { Schema } from 'effect'
import {
  eventKey,
  isEventReference,
  propertyKey,
  type EventDefinitions,
  type EventReference,
  type PropertyOf,
  type PropertyReference,
  type SharedEventOutput,
} from './event'

export const MeterFilterClause = Schema.Struct({
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
  value: Schema.Union([
    Schema.String.check(Schema.isMaxLength(1000)),
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(-2147483648),
      Schema.isLessThanOrEqualTo(2147483647),
    ),
    Schema.Boolean,
  ]),
})

export type MeterFilterClause = typeof MeterFilterClause.Type

export interface MeterFilter {
  readonly conjunction: 'and' | 'or'
  readonly clauses: readonly (MeterFilterClause | MeterFilter)[]
}

export const MeterFilter = Schema.Struct({
  conjunction: Schema.Literals(['and', 'or']),
  clauses: Schema.Array(
    Schema.Union([
      MeterFilterClause,
      Schema.suspend((): Schema.Codec<MeterFilter> => MeterFilter),
    ]),
  ),
})

export const MeterAggregation = Schema.Union([
  Schema.Struct({ func: Schema.Literal('count') }),
  Schema.Struct({
    func: Schema.Literals(['sum', 'max', 'min', 'avg', 'unique']),
    property: Schema.String,
  }),
])

export type MeterAggregation = typeof MeterAggregation.Type

const meterFields = {
  external_id: Schema.String.check(Schema.isMinLength(1)),
  name: Schema.String.check(Schema.isMinLength(3)),
  filter: MeterFilter,
  aggregation: MeterAggregation,
}

export const MeterConfig = Schema.Union([
  Schema.Struct({ ...meterFields, unit: Schema.Literals(['scalar', 'token']) }),
  Schema.Struct({
    ...meterFields,
    unit: Schema.Literal('custom'),
    custom_label: Schema.String,
  }),
])

export type MeterConfig = typeof MeterConfig.Type

type ScalarValue = MeterFilterClause['value']

const scopeKey: unique symbol = Symbol.for('~@polar-sh/polar/ConditionScope')

type Scoped<Names extends string> = { readonly [scopeKey]?: Names }

export type Condition<Names extends string = never> = (
  | MeterFilterClause
  | MeterFilter
) &
  Scoped<Names>

type ConditionInput<Names extends string> =
  | Condition<Names>
  | EventReference<Names>

interface EqualityComparison {
  (property: string, value: ScalarValue): Condition
  <Name extends string, Value extends ScalarValue>(
    property: PropertyReference<Name, Value>,
    value: NoInfer<Value>,
  ): Condition<Name>
}

interface TypedComparison<Type extends ScalarValue> {
  (property: string, value: ScalarValue): Condition
  <Name extends string>(
    property: PropertyReference<Name, Type>,
    value: Type,
  ): Condition<Name>
}

const comparison =
  (operator: MeterFilterClause['operator']) =>
  (
    property: string | PropertyReference<string, ScalarValue>,
    value: ScalarValue,
  ): Condition<string> =>
    typeof property === 'string'
      ? { property, operator, value }
      : {
          property: property[propertyKey],
          operator,
          value,
          [scopeKey]: property[eventKey],
        }

export const eq = comparison('eq') as EqualityComparison
export const ne = comparison('ne') as EqualityComparison
export const gt = comparison('gt') as TypedComparison<number>
export const gte = comparison('gte') as TypedComparison<number>
export const lt = comparison('lt') as TypedComparison<number>
export const lte = comparison('lte') as TypedComparison<number>
export const like = comparison('like') as TypedComparison<string>
export const notLike = comparison('not_like') as TypedComparison<string>

const toCondition = (input: ConditionInput<string>): Condition<string> =>
  isEventReference(input) ? eq('name', input[eventKey]) : input

const group =
  (conjunction: MeterFilter['conjunction']) =>
  <Names extends string = never>(
    ...clauses: readonly ConditionInput<Names>[]
  ): MeterFilter & Scoped<Names> => ({
    conjunction,
    clauses: clauses.map(toCondition),
  })

export const and = group('and')
export const or = group('or')

// A meter over a single event already requires that event's name, so
// conditions scoped to it don't need to repeat it.
const expand = (
  condition: Condition<string>,
  events: readonly string[],
): MeterFilterClause | MeterFilter => {
  if ('conjunction' in condition) {
    return {
      conjunction: condition.conjunction,
      clauses: condition.clauses.map((clause) => expand(clause, events)),
    }
  }
  const clause = {
    property: condition.property,
    operator: condition.operator,
    value: condition.value,
  }
  const event = condition[scopeKey]
  return event === undefined || (events.length === 1 && events[0] === event)
    ? clause
    : and(eq('name', event), clause)
}

type Unit =
  | { readonly unit: 'scalar' | 'token' }
  | { readonly unit: 'custom'; readonly custom_label: string }

type Property<Metadata, Type> = unknown extends Metadata
  ? string
  : PropertyOf<Metadata, Type>

export class MeterBuilder<Names extends string = string, Metadata = unknown> {
  constructor(
    protected readonly name: string | undefined = undefined,
    private readonly meterFilter: MeterFilter = {
      conjunction: 'and',
      clauses: [],
    },
    protected readonly meterUnit: Unit = { unit: 'scalar' },
    private readonly events: readonly string[] = [],
  ) {}

  where(input: ConditionInput<Names>): MeterBuilder<Names, Metadata> {
    const condition = expand(toCondition(input), this.events)
    const filter = 'conjunction' in condition ? condition : and(condition)
    const combined: MeterFilter =
      this.meterFilter.clauses.length === 0
        ? filter
        : {
            conjunction: 'and',
            clauses: [
              ...(this.meterFilter.conjunction === 'and'
                ? this.meterFilter.clauses
                : [this.meterFilter]),
              ...(filter.conjunction === 'and' ? filter.clauses : [filter]),
            ],
          }
    return new MeterBuilder(
      this.name,
      structuredClone(combined),
      this.meterUnit,
      this.events,
    )
  }

  unit(
    ...args: [unit: 'scalar' | 'token'] | [unit: 'custom', label: string]
  ): MeterBuilder<Names, Metadata> {
    const unit: Unit =
      args[0] === 'custom'
        ? { unit: 'custom', custom_label: args[1] }
        : { unit: args[0] }
    return new MeterBuilder(this.name, this.meterFilter, unit, this.events)
  }

  count() {
    return this.aggregate({ func: 'count' })
  }

  sum(property: Property<Metadata, number>) {
    return this.aggregate({ func: 'sum', property })
  }

  max(property: Property<Metadata, number>) {
    return this.aggregate({ func: 'max', property })
  }

  min(property: Property<Metadata, number>) {
    return this.aggregate({ func: 'min', property })
  }

  avg(property: Property<Metadata, number>) {
    return this.aggregate({ func: 'avg', property })
  }

  unique(property: Property<Metadata, ScalarValue>) {
    return this.aggregate({ func: 'unique', property })
  }

  private aggregate(aggregation: MeterAggregation) {
    return {
      name: this.name,
      filter: structuredClone(this.meterFilter),
      aggregation,
      ...this.meterUnit,
    }
  }
}

export type MeterDefinition = ReturnType<MeterBuilder['count']>

export class UnboundMeter<
  Events extends EventDefinitions,
> extends MeterBuilder {
  on<const Name extends keyof Events & string>(
    events:
      | EventReference<Name>
      | readonly [EventReference<Name>, ...EventReference<Name>[]],
  ): MeterBuilder<Name, SharedEventOutput<Events, Name>> {
    const references: readonly unknown[] = Array.isArray(events)
      ? events
      : [events]
    if (references.length === 0 || !references.every(isEventReference)) {
      throw new Error('on() takes one or more events from the `events` helper.')
    }
    const names = references.map((reference) => reference[eventKey] as Name)
    const clauses = names.map((name) => eq('name', name))
    return new MeterBuilder(
      this.name,
      clauses.length === 1 ? and(...clauses) : or(...clauses),
      this.meterUnit,
      names,
    )
  }
}

export const meter = <Events extends EventDefinitions = Record<never, never>>(
  name?: string,
): UnboundMeter<Events> => new UnboundMeter(name)
