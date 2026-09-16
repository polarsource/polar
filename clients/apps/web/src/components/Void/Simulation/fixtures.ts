import { Scenario, ScenarioLevers } from './types'

export const BASELINE_LEVERS: ScenarioLevers = {
  plans: [
    { id: 'scale', name: 'Scale', monthlyPrice: 49_900, includedUsage: 25_000 },
    { id: 'team', name: 'Team', monthlyPrice: 9_900, includedUsage: 5_000 },
    { id: 'starter', name: 'Starter', monthlyPrice: 1_900, includedUsage: 0 },
  ],
  meters: [
    {
      id: 'output_tokens',
      name: 'Output tokens',
      unit: '1M tokens',
      per: 1_000_000,
      price: 800,
    },
    {
      id: 'input_tokens',
      name: 'Input tokens',
      unit: '1M tokens',
      per: 1_000_000,
      price: 150,
    },
    {
      id: 'tool_calls',
      name: 'Tool calls',
      unit: '1K calls',
      per: 1_000,
      price: 40,
    },
  ],
  assumptions: {
    usageGrowth: 8,
    newCustomers: 3,
    churnTolerance: 20,
    churnElasticity: 15,
  },
}

export const BASED_ON = { version: 'main · v14' }
export const PROMOTED_VERSION = 'v15-draft'

const withPlans = (
  overrides: Record<string, Partial<ScenarioLevers['plans'][number]>>,
) => BASELINE_LEVERS.plans.map((plan) => ({ ...plan, ...overrides[plan.id] }))

const withMeters = (
  overrides: Record<string, Partial<ScenarioLevers['meters'][number]>>,
) =>
  BASELINE_LEVERS.meters.map((meter) => ({
    ...meter,
    ...overrides[meter.id],
  }))

const at = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const preset = (
  id: string,
  name: string,
  created: number,
  updated: number,
  levers: ScenarioLevers,
): Scenario => ({
  id,
  name,
  basedOn: BASED_ON,
  createdAt: at(created),
  updatedAt: at(updated),
  promotedAs: null,
  levers,
  baseLevers: BASELINE_LEVERS,
  patch: { products: {}, meters: {} },
})

export const PRESET_SCENARIOS: Scenario[] = [
  preset('usage-first', 'Usage-first', 6, 1, {
    plans: withPlans({
      scale: { monthlyPrice: 24_900, includedUsage: 0 },
      team: { includedUsage: 0 },
    }),
    meters: withMeters({ output_tokens: { price: 1_200 } }),
    assumptions: BASELINE_LEVERS.assumptions,
  }),
  preset('enterprise-uplift', 'Enterprise uplift', 3, 2, {
    plans: withPlans({
      scale: { monthlyPrice: 79_900, includedUsage: 50_000 },
    }),
    meters: BASELINE_LEVERS.meters,
    assumptions: BASELINE_LEVERS.assumptions,
  }),
  preset('free-starter', 'Free Starter', 12, 9, {
    plans: withPlans({
      starter: { monthlyPrice: 0, includedUsage: 1_000 },
      team: { monthlyPrice: 12_900 },
    }),
    meters: BASELINE_LEVERS.meters,
    assumptions: { ...BASELINE_LEVERS.assumptions, newCustomers: 6 },
  }),
]

export const blankScenario = (id: string, name: string): Scenario =>
  preset(id, name, 0, 0, structuredClone(BASELINE_LEVERS))
