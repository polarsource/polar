import { addMonths, startOfMonth, subDays } from 'date-fns'
import { buildTree, walk } from '../identities'
import { getVoidData } from '../mock'
import { VoidData } from '../types'
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

interface CustomerUsage {
  id: string
  name: string
  plan: string | null
  trialing: boolean
  /** Daily units per meter name for the customer and everything below it. */
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

const collectCustomers = (data: VoidData): CustomerUsage[] => {
  const tree = buildTree(data.identities)
  return tree.roots
    .map((root) => {
      const subscription = data.subscriptions.find(
        (candidate) => candidate.identity_id === root.identity.id,
      )
      const units: Record<string, number[]> = {}
      for (const node of walk(root)) {
        for (const [meter, total] of Object.entries(node.identity.meters)) {
          const series = node.identity.usageSeries[meter] ?? []
          const weight = sum(series)
          const target = (units[meter] ??= Array.from(
            { length: DAYS },
            () => 0,
          ))
          for (let day = 0; day < DAYS; day++) {
            target[day] +=
              weight > 0 ? (total * (series[day] ?? 0)) / weight : total / DAYS
          }
        }
      }
      return {
        id: root.identity.id,
        name: root.identity.name,
        plan: subscription?.product ?? null,
        trialing: subscription?.status === 'trialing',
        units,
      }
    })
    .filter((customer) => customer.plan !== null)
}

const billFor = (customer: CustomerUsage, levers: ScenarioLevers): Bill => {
  const plan = levers.plans.find(
    (candidate) => candidate.name === customer.plan,
  )
  const daily = Array.from({ length: DAYS }, () => 0)
  const usageByMeter: Record<string, number> = {}
  for (const meter of levers.meters) {
    const series = customer.units[meter.name]
    if (!series) continue
    let meterTotal = 0
    series.forEach((value, day) => {
      const cost = (value * meter.price) / meter.per
      daily[day] += cost
      meterTotal += cost
    })
    usageByMeter[meter.name] = meterTotal
  }
  const usage = sum(daily)
  const fee = plan && !customer.trialing ? plan.monthlyPrice : 0
  const overage = Math.max(0, usage - (plan?.includedUsage ?? 0))
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

let cachedData: VoidData | null = null
const data = () => (cachedData ??= getVoidData())

export const replay = (
  levers: ScenarioLevers,
  base: ScenarioLevers,
): ReplayResult => {
  const customers = collectCustomers(data())
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
        plan: customer.plan,
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
        const share = bill.usage > 0 ? bill.daily[day] / bill.usage : 1 / DAYS
        point[key] += bill.fee / DAYS + bill.overage * share
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
            .filter((b) => b.customer.plan === plan.name)
            .map((b) => b.baseline.fee),
        ),
      ),
      scenario: round(
        sum(
          bills
            .filter((b) => b.customer.plan === plan.name)
            .map((b) => b.scenario.fee),
        ),
      ),
    })),
    ...levers.meters.map((meter) => {
      const attributed = (bill: Bill) =>
        bill.usage > 0
          ? (bill.overage * (bill.usageByMeter[meter.name] ?? 0)) / bill.usage
          : 0
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
): ProjectionPoint[] => {
  const customers = collectCustomers(data())
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
