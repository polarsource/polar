/**
 * Public API — `import { ... } from "@polar-sh/local"`.
 *
 * This is what an integrator uses to author their billing as code (in their own
 * repo) and hand it to the service via `LOCAL_BILLING`. See the README.
 */

// Billing DSL — define products and meters.
export { product, perUnit, priceOf } from './dsl'
export type { Plan, MeterLine, PerUnit } from './dsl'

// Meter aggregations (filter by event name, aggregate a metadata property).
export { count, sumOf, maxOf, lastOf } from './meter'
export type { Aggregation, MeterState } from './meter'

// Exact money — integer micro-cents. Never use a float for money.
export {
  dollars,
  cents,
  micros,
  zero,
  add,
  mul,
  toCents,
  format,
} from './money'
export type { Money } from './money'

// Versioned rulesets + invoice computation (time-travel / what-if).
export {
  rulesetHistory,
  rulesetAt,
  rulesetByVersion,
  currentRuleset,
  invoiceFor,
} from './ruleset'
export type { Ruleset, RulesetHistory, InvoiceForArgs } from './ruleset'

// Core types for working with events and invoices.
export type { CustomerRef, Period, UsageEvent } from './events'
export type { Invoice, LineItem } from './engine'
