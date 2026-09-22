import { addMonths, startOfMonth, subDays } from 'date-fns'
import {
  Assumptions,
  ComponentResult,
  CustomerResult,
  ProjectionPoint,
  ReplayResult,
  ScenarioLevers,
} from './types'

const DAYS = 30
const HORIZON_MONTHS = 12

export interface CustomerUsage {
  id: string
  name: string
  plan: string
  /** Daily units per reducer slug, including child identities. */
  units: Record<string, number[]>
}

interface Bill {
  fee: number
  overage: number
  usage: number
  usageByMeter: Record<string, number>
  daily: number[]
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

const billFor = (customer: CustomerUsage, levers: ScenarioLevers): Bill => {
  const plan = levers.plans.find((candidate) => candidate.id === customer.plan)
  const daily = Array.from({ length: DAYS }, () => 0)
  const usageByMeter: Record<string, number> = {}
  let usage = 0
  for (const meter of levers.meters) {
    const series = customer.units[meter.reducer]
    const included = plan?.includedUsage[meter.id]
    if (!series || included === undefined) continue
    let remaining = included
    let meterTotal = 0
    series.forEach((value, day) => {
      usage += (value * meter.price) / meter.per
      const cost = (Math.max(0, value - remaining) * meter.price) / meter.per
      remaining = Math.max(0, remaining - value)
      daily[day] += cost
      meterTotal += cost
    })
    usageByMeter[meter.id] = meterTotal
  }
  const fee = plan?.monthlyPrice ?? 0
  const overage = sum(daily)
  return { fee, overage, usage, usageByMeter, daily }
}

export const churnRiskFor = (
  baseline: number,
  scenario: number,
  assumptions: Assumptions,
): number => {
  if (baseline <= 0) return 0
  const excess =
    (scenario - baseline) / baseline - assumptions.churnTolerance / 100
  if (excess <= 0) return 0
  return Math.min(1, (excess / 0.1) * (assumptions.churnElasticity / 100))
}

const round = (value: number) => Math.round(value)

export const replay = (
  levers: ScenarioLevers,
  base: ScenarioLevers,
  customers: CustomerUsage[],
): ReplayResult => {
  const bills = customers.map((customer) => ({
    customer,
    baseline: billFor(customer, base),
    scenario: billFor(customer, levers),
  }))

  const results: CustomerResult[] = bills
    .map(({ customer, baseline, scenario }) => {
      const before = round(baseline.fee + baseline.overage)
      const after = round(scenario.fee + scenario.overage)
      return {
        id: customer.id,
        name: customer.name,
        plan:
          levers.plans.find((plan) => plan.id === customer.plan)?.name ??
          customer.plan,
        baseline: before,
        scenario: after,
        delta: after - before,
        deltaPct: before > 0 ? (after - before) / before : null,
        churnRisk: churnRiskFor(before, after, levers.assumptions),
        usage: round(scenario.usage),
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const end = new Date()
  const daily = Array.from({ length: DAYS }, (_, day) => {
    const point = { baseline: 0, scenario: 0 }
    for (const { baseline, scenario } of bills) {
      for (const [key, bill] of [
        ['baseline', baseline],
        ['scenario', scenario],
      ] as const) {
        point[key] += bill.fee / DAYS + bill.daily[day]
      }
    }
    return {
      timestamp: subDays(end, DAYS - 1 - day).toISOString(),
      baseline: round(point.baseline),
      scenario: round(point.scenario),
    }
  })

  const components: ComponentResult[] = [
    ...levers.plans.map((plan) => ({
      key: plan.id,
      label: `${plan.name} fees`,
      group: 'Subscriptions' as const,
      baseline: round(
        sum(
          bills
            .filter((b) => b.customer.plan === plan.id)
            .map((b) => b.baseline.fee),
        ),
      ),
      scenario: round(
        sum(
          bills
            .filter((b) => b.customer.plan === plan.id)
            .map((b) => b.scenario.fee),
        ),
      ),
    })),
    ...levers.meters.map((meter) => {
      const attributed = (bill: Bill) => bill.usageByMeter[meter.id] ?? 0
      return {
        key: meter.id,
        label: meter.name,
        group: 'Usage' as const,
        baseline: round(sum(bills.map((b) => attributed(b.baseline)))),
        scenario: round(sum(bills.map((b) => attributed(b.scenario)))),
      }
    }),
  ]

  const totalBaseline = sum(results.map((r) => r.baseline))
  const totalScenario = sum(results.map((r) => r.scenario))
  const expected = round(
    sum(results.map((r) => r.scenario * (1 - r.churnRisk))),
  )

  return {
    customers: results,
    daily,
    components,
    totals: { baseline: totalBaseline, scenario: totalScenario, expected },
    counts: {
      up: results.filter((r) => r.delta > 0).length,
      down: results.filter((r) => r.delta < 0).length,
      flat: results.filter((r) => r.delta === 0).length,
      atRisk: results.filter((r) => r.churnRisk > 0).length,
    },
  }
}

export const project = (
  levers: ScenarioLevers,
  base: ScenarioLevers,
  customers: CustomerUsage[],
): ProjectionPoint[] => {
  const bills = customers.map((customer) => ({
    baseline: billFor(customer, base),
    scenario: billFor(customer, levers),
  }))
  const count = bills.length || 1
  const { usageGrowth, newCustomers } = levers.assumptions
  const start = startOfMonth(new Date())

  return Array.from({ length: HORIZON_MONTHS + 1 }, (_, month) => {
    const growth = (1 + usageGrowth / 100) ** month
    const cohort = (count + newCustomers * month) / count
    let baseline = 0
    let scenario = 0
    let retained = 0
    for (const bill of bills) {
      const before = bill.baseline.fee + bill.baseline.overage * growth
      const after = bill.scenario.fee + bill.scenario.overage * growth
      const risk = churnRiskFor(
        bill.baseline.fee + bill.baseline.overage,
        bill.scenario.fee + bill.scenario.overage,
        levers.assumptions,
      )
      baseline += before
      scenario += after
      retained += after * (1 - risk)
    }
    const newRevenue = (scenario / count) * newCustomers * month
    return {
      timestamp: addMonths(start, month).toISOString(),
      baseline: round(baseline * cohort),
      scenario: round(scenario * cohort),
      expected: round(retained + newRevenue),
    }
  })
}
