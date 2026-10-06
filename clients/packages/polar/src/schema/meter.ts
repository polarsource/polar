import { Schema } from 'effect'

export const MeterFilter = Schema.Struct({
  conjunction: Schema.Literals(['and', 'or']),
  clauses: Schema.Array(
    Schema.Struct({
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
    }),
  ),
})

export type MeterFilter = typeof MeterFilter.Type

export const MeterAggregation = Schema.Union([
  Schema.Struct({ func: Schema.Literal('count') }),
  Schema.Struct({
    func: Schema.Literals(['sum', 'max', 'min', 'avg', 'unique']),
    property: Schema.String,
  }),
])

export type MeterAggregation = typeof MeterAggregation.Type

const meterFields = {
  external_id: Schema.String,
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

type Comparison = Pick<MeterFilter['clauses'][number], 'operator' | 'value'>

const comparison =
  (operator: Comparison['operator']) =>
  (value: Comparison['value']): Comparison => ({ operator, value })

export const eq = comparison('eq')
export const ne = comparison('ne')
export const gt = comparison('gt')
export const gte = comparison('gte')
export const lt = comparison('lt')
export const lte = comparison('lte')
export const like = comparison('like')
export const notLike = comparison('not_like')

type Unit =
  | { readonly unit: 'scalar' | 'token' }
  | { readonly unit: 'custom'; readonly custom_label: string }

class MeterBuilder {
  constructor(
    private readonly name: string,
    private readonly meterFilter: MeterFilter,
    private readonly meterUnit: Unit = { unit: 'scalar' },
  ) {}

  where(conditions: Readonly<Record<string, Comparison>>): MeterBuilder {
    if (this.meterFilter.conjunction !== 'and') {
      throw new Error(
        'where() requires an and filter; use filter() for or filters.',
      )
    }
    return this.filter({
      conjunction: 'and',
      clauses: [
        ...this.meterFilter.clauses,
        ...Object.entries(conditions).map(([property, condition]) => ({
          property,
          ...condition,
        })),
      ],
    })
  }

  filter(filter: MeterFilter): MeterBuilder {
    return new MeterBuilder(this.name, structuredClone(filter), this.meterUnit)
  }

  unit(
    ...args: [unit: 'scalar' | 'token'] | [unit: 'custom', label: string]
  ): MeterBuilder {
    const unit: Unit =
      args[0] === 'custom'
        ? { unit: 'custom', custom_label: args[1] }
        : { unit: args[0] }
    return new MeterBuilder(this.name, this.meterFilter, unit)
  }

  count() {
    return this.aggregate({ func: 'count' })
  }

  sum(property: string) {
    return this.aggregate({ func: 'sum', property })
  }

  max(property: string) {
    return this.aggregate({ func: 'max', property })
  }

  min(property: string) {
    return this.aggregate({ func: 'min', property })
  }

  avg(property: string) {
    return this.aggregate({ func: 'avg', property })
  }

  unique(property: string) {
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

export const fold = (name: string, event?: string): MeterBuilder =>
  new MeterBuilder(name, {
    conjunction: 'and',
    clauses:
      event === undefined
        ? []
        : [{ property: 'name', operator: 'eq', value: event }],
  })
