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

export const MeterAggregation = Schema.Union([
  Schema.Struct({ func: Schema.Literal('count') }),
  Schema.Struct({
    func: Schema.Literals(['sum', 'max', 'min', 'avg', 'unique']),
    property: Schema.String,
  }),
])

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
