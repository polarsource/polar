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

export const BASED_ON = { definition: 'main', version: 'v14' }

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

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'usage-first',
    name: 'Usage-first',
    basedOn: BASED_ON,
    createdAt: at(6),
    updatedAt: at(1),
    promotedAs: null,
    levers: {
      plans: withPlans({
        scale: { monthlyPrice: 24_900, includedUsage: 0 },
        team: { includedUsage: 0 },
      }),
      meters: withMeters({ output_tokens: { price: 1_200 } }),
      assumptions: BASELINE_LEVERS.assumptions,
    },
  },
  {
    id: 'enterprise-uplift',
    name: 'Enterprise uplift',
    basedOn: BASED_ON,
    createdAt: at(3),
    updatedAt: at(2),
    promotedAs: null,
    levers: {
      plans: withPlans({
        scale: { monthlyPrice: 79_900, includedUsage: 50_000 },
      }),
      meters: BASELINE_LEVERS.meters,
      assumptions: BASELINE_LEVERS.assumptions,
    },
  },
  {
    id: 'free-starter',
    name: 'Free Starter',
    basedOn: BASED_ON,
    createdAt: at(12),
    updatedAt: at(9),
    promotedAs: null,
    levers: {
      plans: withPlans({
        starter: { monthlyPrice: 0, includedUsage: 1_000 },
        team: { monthlyPrice: 12_900 },
      }),
      meters: BASELINE_LEVERS.meters,
      assumptions: { ...BASELINE_LEVERS.assumptions, newCustomers: 6 },
    },
  },
]

export const blankScenario = (id: string, name: string): Scenario => ({
  id,
  name,
  basedOn: BASED_ON,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  promotedAs: null,
  levers: structuredClone(BASELINE_LEVERS),
})

export const changedLevers = (levers: ScenarioLevers): string[] => {
  const changed: string[] = []
  levers.plans.forEach((plan, index) => {
    const base = BASELINE_LEVERS.plans[index]
    if (plan.monthlyPrice !== base.monthlyPrice)
      changed.push(`${plan.name} price`)
    if (plan.includedUsage !== base.includedUsage) {
      changed.push(`${plan.name} allowance`)
    }
  })
  levers.meters.forEach((meter, index) => {
    if (meter.price !== BASELINE_LEVERS.meters[index].price) {
      changed.push(`${meter.name} price`)
    }
  })
  return changed
}
