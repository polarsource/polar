import { Schema } from 'effect'
import { ConfigResource } from '@/schemas/BillingConfig'

const Component = Schema.Struct({
  label: Schema.String,
  kind: Schema.Literals(['fee', 'usage']),
  meter_external_id: Schema.optional(Schema.NullOr(Schema.String)),
  baseline: Schema.Finite,
  proposed: Schema.Finite,
})

const Cohort = Schema.Struct({
  product_external_id: Schema.String,
  price_label: Schema.String,
  subscribers: Schema.Finite,
  baseline_monthly: Schema.Finite,
  proposed_monthly: Schema.Finite,
  components: Schema.Array(Component),
})

export const SimulationResult = Schema.Struct({
  monthly_delta: Schema.Finite,
  currency: Schema.String,
  counts: Schema.Struct({
    more: Schema.Finite,
    less: Schema.Finite,
    same: Schema.Finite,
    no_history: Schema.Finite,
  }),
  cohorts: Schema.Array(Cohort),
  not_simulated: Schema.Array(
    Schema.Struct({
      resource: ConfigResource,
      external_id: Schema.String,
      reason: Schema.String,
    }),
  ),
})
export type SimulationResult = typeof SimulationResult.Type

export const SimulationResponse = Schema.Array(SimulationResult)
export type SimulationResponse = typeof SimulationResponse.Type

export const SimulateOutput = Schema.Struct({
  file: Schema.String,
  results: SimulationResponse,
})
