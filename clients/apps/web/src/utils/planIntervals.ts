import { schemas } from '@polar-sh/client'

type Plan = schemas['OrganizationPlan']

export type PlanInterval = 'month' | 'year'

export const PLAN_INTERVALS: PlanInterval[] = ['month', 'year']

export const PLAN_INTERVAL_LABELS: Record<PlanInterval, string> = {
  month: 'Monthly',
  year: 'Annual',
}

const isPlanInterval = (
  interval: string | null | undefined,
): interval is PlanInterval => PLAN_INTERVALS.includes(interval as PlanInterval)

export const availablePlanIntervals = (plans: Plan[]): PlanInterval[] =>
  PLAN_INTERVALS.filter((interval) =>
    plans.some((plan) => plan.recurring_interval === interval),
  )

export const defaultPlanInterval = (
  available: PlanInterval[],
  preferred: (string | null | undefined)[],
): PlanInterval => {
  const match = preferred.find(
    (interval): interval is PlanInterval =>
      isPlanInterval(interval) && available.includes(interval),
  )
  return match ?? available[0] ?? 'month'
}

// Plans without an interval (the synthesized free plan) show under every tab.
export const filterPlansByInterval = (
  plans: Plan[],
  interval: PlanInterval,
): Plan[] =>
  plans.filter(
    (plan) =>
      plan.recurring_interval == null || plan.recurring_interval === interval,
  )

export const isIntervalSwitch = (from: Plan, to: Plan): boolean =>
  from.tier === to.tier &&
  from.recurring_interval != null &&
  to.recurring_interval != null &&
  from.recurring_interval !== to.recurring_interval

// The plan's same-tier equivalent at another interval; plans without an
// interval (the free plan) show under every tab, so they carry over as-is.
export const planForInterval = (
  plan: Plan,
  plans: Plan[],
  interval: PlanInterval,
): Plan | null =>
  plan.recurring_interval == null
    ? plan
    : (plans.find(
        (p) => p.tier === plan.tier && p.recurring_interval === interval,
      ) ?? null)

export const monthlyPlanAmount = (plan: Plan): number => {
  const amount = plan.price?.amount ?? 0
  return plan.recurring_interval === 'year' ? amount / 12 : amount
}

export const annualMonthsFree = (plan: Plan, plans: Plan[]): number | null => {
  if (plan.recurring_interval !== 'year' || !plan.price?.amount) return null
  const monthlyAmount = plans.find(
    (p) => p.tier === plan.tier && p.recurring_interval === 'month',
  )?.price?.amount
  if (!monthlyAmount) return null
  const monthsFree = Math.round(
    (monthlyAmount * 12 - plan.price.amount) / monthlyAmount,
  )
  return monthsFree > 0 ? monthsFree : null
}
