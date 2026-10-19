import { describe, expect, test } from 'vitest'
import type { SimulationResult } from '@/schemas/Simulation'
import { analyze, churnRisk } from '@/utils/simulation-analysis'

const assumptions = { churn_tolerance_pct: 10, churn_elasticity_pct: 20 }

const cohort = (subscribers: number, baseline: number, proposed: number) => ({
  product_external_id: 'starter',
  price_label: '$10.00',
  archived: false,
  partial: false,
  recurring_interval: 'month' as const,
  recurring_interval_count: 1,
  subscribers,
  baseline,
  proposed,
  components: [],
})

const result: SimulationResult = {
  window: {
    since: '2026-07-01T00:00:00Z',
    until: '2026-10-01T00:00:00Z',
    months: 3,
  },
  currency: 'usd',
  baseline: 3_000,
  proposed: 4_200,
  monthly_delta: 400,
  counts: { more: 4, less: 0, same: 0, no_history: 0, not_simulated: 0 },
  cohorts: [cohort(2, 2_000, 2_200), cohort(2, 1_000, 2_000)],
  not_simulated: [],
}

describe('churnRisk', () => {
  test.each([
    [1_000, 1_100, 0],
    [1_000, 1_200, 0.2],
    [1_000, 1_500, 0.8],
    [1_000, 5_000, 1],
    [1_000, 900, 0],
    [0, 1_000, 0],
  ])('%i → %i is %d', (baseline, proposed, risk) => {
    expect(churnRisk(baseline, proposed, assumptions)).toBeCloseTo(risk)
  })
})

describe('analyze', () => {
  test('adds the change and leaves churn out without assumptions', () => {
    const [analyzed] = analyze([result], null)
    expect(analyzed).toMatchObject({
      change_pct: 40,
      expected_monthly_delta: null,
      subscribers_at_risk: null,
    })
    expect(
      analyzed?.cohorts.map((c) => [c.change_pct, c.churn_risk_pct]),
    ).toEqual([
      [10, null],
      [100, null],
    ])
  })

  test('discounts the proposed amounts by each cohort churn risk, per month', () => {
    const [analyzed] = analyze([result], assumptions)
    expect(analyzed?.cohorts.map((c) => c.churn_risk_pct)).toEqual([0, 100])
    expect(analyzed).toMatchObject({
      expected_monthly_delta: Math.round((2_200 - 3_000) / 3),
      subscribers_at_risk: 2,
    })
  })
})
