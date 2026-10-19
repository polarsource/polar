import type {
  AnalyzedResult,
  ChurnAssumptions,
  SimulationResult,
} from '@/schemas/Simulation'

const percent = (baseline: number, proposed: number) =>
  baseline > 0
    ? Math.round(((proposed - baseline) / baseline) * 1000) / 10
    : null

export const churnRisk = (
  baseline: number,
  proposed: number,
  { churn_tolerance_pct, churn_elasticity_pct }: ChurnAssumptions,
) => {
  if (baseline <= 0) return 0
  const excess = (proposed - baseline) / baseline - churn_tolerance_pct / 100
  if (excess <= 0) return 0
  return Math.min(1, (excess / 0.1) * (churn_elasticity_pct / 100))
}

export const analyze = (
  results: ReadonlyArray<SimulationResult>,
  assumptions: ChurnAssumptions | null,
): AnalyzedResult[] =>
  results.map((result) => {
    const { breakdown } = result
    const risks = breakdown.map((c) =>
      assumptions === null
        ? null
        : churnRisk(c.baseline, c.proposed, assumptions),
    )
    const { baseline, proposed, window } = result
    const retained = breakdown.reduce(
      (sum, c, index) => sum + c.proposed * (1 - (risks[index] ?? 0)),
      0,
    )
    return {
      ...result,
      breakdown: breakdown.map((c, index) => {
        const risk = risks[index] ?? null
        return {
          ...c,
          change_pct: percent(c.baseline, c.proposed),
          churn_risk_pct: risk === null ? null : Math.round(risk * 1000) / 10,
        }
      }),
      change_pct: percent(baseline, proposed),
      expected_monthly_delta:
        assumptions && Math.round((retained - baseline) / window.months),
      subscribers_at_risk:
        assumptions &&
        breakdown
          .filter((_, index) => (risks[index] ?? 0) > 0)
          .reduce((sum, c) => sum + c.subscribers, 0),
    }
  })
