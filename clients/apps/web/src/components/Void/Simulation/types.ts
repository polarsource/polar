import { VoidBranchPatch } from '../api'

export interface PlanLever {
  id: string
  name: string
  /** Monthly subscription fee, in cents. */
  monthlyPrice: number
  /** Usage covered by the fee before overage starts, in cents. */
  includedUsage: number
}

export interface MeterLever {
  id: string
  name: string
  unit: string
  /** Units covered by one `price`, e.g. 1,000,000 tokens. */
  per: number
  /** Price per `per` units, in cents. */
  price: number
}

export interface Assumptions {
  /** Month over month growth of usage per customer, in percent. */
  usageGrowth: number
  /** New paying customers per month, assumed to look like today's average. */
  newCustomers: number
  /** Bill increase customers absorb without reacting, in percent. */
  churnTolerance: number
  /** Share of customers expected to churn per 10% increase past the tolerance, in percent. */
  churnElasticity: number
}

export interface ScenarioLevers {
  plans: PlanLever[]
  meters: MeterLever[]
  assumptions: Assumptions
}

export interface Scenario {
  id: string
  name: string
  /** The deployed version this scenario forks. Pinned; it never rebases. */
  basedOn: { version: string; label: string }
  createdAt: string
  updatedAt: string
  /** Short hash of the draft version this scenario was promoted to. */
  promotedAs: string | null
  levers: ScenarioLevers
  /** Levers of the base version, what the engine compares against. */
  baseLevers: ScenarioLevers
  patch: VoidBranchPatch
}

export interface CustomerResult {
  id: string
  name: string
  plan: string | null
  baseline: number
  scenario: number
  delta: number
  /** Null when the baseline bill was zero. */
  deltaPct: number | null
  /** Probability the customer churns in response to the change, 0 to 1. */
  churnRisk: number
  /** Usage under the scenario, in cents, before allowances. */
  usage: number
}

export interface ComponentResult {
  key: string
  label: string
  group: 'Subscriptions' | 'Usage'
  baseline: number
  scenario: number
}

export type DailyPoint = {
  timestamp: string
  baseline: number
  scenario: number
}

export interface ReplayResult {
  customers: CustomerResult[]
  daily: DailyPoint[]
  components: ComponentResult[]
  totals: { baseline: number; scenario: number; expected: number }
  counts: { up: number; down: number; flat: number; atRisk: number }
}

export type ProjectionPoint = {
  timestamp: string
  baseline: number
  scenario: number
  expected: number
}
