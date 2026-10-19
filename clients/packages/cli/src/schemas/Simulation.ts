import { Schema } from 'effect'
import { ConfigResource } from '@/schemas/BillingConfig'

const BreakdownItem = Schema.Struct({
  product_external_id: Schema.String,
  price_label: Schema.String,
  archived: Schema.Boolean,
  partial: Schema.Boolean,
  recurring_interval: Schema.Literals(['day', 'week', 'month', 'year']),
  recurring_interval_count: Schema.Finite,
  subscribers: Schema.Finite,
  baseline: Schema.Finite,
  proposed: Schema.Finite,
})

export const SimulationWindow = Schema.Struct({
  since: Schema.String,
  until: Schema.String,
  months: Schema.Finite,
})
export type SimulationWindow = typeof SimulationWindow.Type

export const SimulationResult = Schema.Struct({
  window: SimulationWindow,
  currency: Schema.String,
  baseline: Schema.Finite,
  proposed: Schema.Finite,
  monthly_delta: Schema.Finite,
  counts: Schema.Struct({
    more: Schema.Finite,
    less: Schema.Finite,
    same: Schema.Finite,
    no_history: Schema.Finite,
    not_simulated: Schema.Finite,
  }),
  breakdown: Schema.Array(BreakdownItem),
  not_simulated: Schema.Array(
    Schema.Struct({
      resource: ConfigResource,
      external_id: Schema.String,
      reason: Schema.String,
      subscribers: Schema.Finite,
    }),
  ),
})
export type SimulationResult = typeof SimulationResult.Type

export const SimulationResponse = Schema.Array(SimulationResult)
export type SimulationResponse = typeof SimulationResponse.Type

export const ChurnAssumptions = Schema.Struct({
  churn_tolerance_pct: Schema.Finite,
  churn_elasticity_pct: Schema.Finite,
})
export type ChurnAssumptions = typeof ChurnAssumptions.Type

const AnalyzedBreakdownItem = Schema.Struct({
  ...BreakdownItem.fields,
  change_pct: Schema.NullOr(Schema.Finite),
  churn_risk_pct: Schema.NullOr(Schema.Finite),
})

export const AnalyzedResult = Schema.Struct({
  ...SimulationResult.fields,
  breakdown: Schema.Array(AnalyzedBreakdownItem),
  change_pct: Schema.NullOr(Schema.Finite),
  expected_monthly_delta: Schema.NullOr(Schema.Finite),
  subscribers_at_risk: Schema.NullOr(Schema.Finite),
})
export type AnalyzedResult = typeof AnalyzedResult.Type

export const SimulateOutput = Schema.Struct({
  file: Schema.String,
  set: Schema.Array(Schema.String),
  assumptions: Schema.NullOr(ChurnAssumptions),
  results: Schema.Array(AnalyzedResult),
})
