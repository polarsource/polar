import { describe, expect, test } from 'vitest'
import { churnRisk } from '@/utils/simulation-analysis'

const assumptions = { churn_tolerance_pct: 10, churn_elasticity_pct: 20 }

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
