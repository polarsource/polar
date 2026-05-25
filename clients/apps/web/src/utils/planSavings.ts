import { schemas } from '@polar-sh/client'

// Early Member orgs (grandfathered, no paid subscription) pay 4% + 40¢ on every
// transaction PLUS a +0.5% surcharge on subscription-product revenue only. Paid
// plans drop the surcharge entirely, so it must be added to savings.
export const EARLY_MEMBER_FEE_PERCENT = 400
export const EARLY_MEMBER_FEE_FIXED = 40
export const EARLY_MEMBER_SUBSCRIPTION_SURCHARGE_BPS = 50

export interface PlanSavingsRecommendation {
  plan: schemas['OrganizationPlan']
  savings: number
}

export interface CurrentPlanContext {
  fee: schemas['OrganizationPlanFee']
  // Surcharge (in basis points) applied on top of `fee` to subscription-product
  // revenue only. Non-zero only for Early Member orgs today.
  subscriptionSurchargeBps: number
  // Monthly subscription-product revenue (cents) to apply the surcharge
  // against. Approximated by MRR (snapshot of active subscriptions).
  subscriptionRevenue: number
}

export const isEarlyMember = (
  subscription: schemas['OrganizationSubscription'],
): boolean =>
  subscription.subscription_id === null &&
  subscription.plan.transaction_fee?.percent === EARLY_MEMBER_FEE_PERCENT &&
  subscription.plan.transaction_fee?.fixed === EARLY_MEMBER_FEE_FIXED

export const monthlyPlanCost = (
  plan: schemas['OrganizationPlan'],
): number | null => {
  if (!plan.price?.amount) return null
  if (plan.recurring_interval === 'year') {
    return Math.round(plan.price.amount / 12)
  }
  return plan.price.amount
}

export const computePlanSavings = (
  revenue: number,
  orders: number,
  current: CurrentPlanContext,
  plan: schemas['OrganizationPlan'],
): number | null => {
  if (!plan.product_id || !plan.transaction_fee) return null
  const monthlyCost = monthlyPlanCost(plan)
  if (monthlyCost === null) return null
  const percentDiff = current.fee.percent - plan.transaction_fee.percent
  const fixedDiff = current.fee.fixed - plan.transaction_fee.fixed
  if (percentDiff <= 0) return null

  const variableSavings = Math.round((revenue * percentDiff) / 10000)
  const fixedSavings = orders * fixedDiff
  const subscriptionSurchargeSavings = Math.round(
    (current.subscriptionRevenue * current.subscriptionSurchargeBps) / 10000,
  )
  return (
    variableSavings + fixedSavings + subscriptionSurchargeSavings - monthlyCost
  )
}

export const pickBestPlanSavings = (
  revenue: number,
  orders: number,
  current: CurrentPlanContext,
  plans: schemas['OrganizationPlan'][],
): PlanSavingsRecommendation | null => {
  let best: PlanSavingsRecommendation | null = null
  for (const plan of plans) {
    const savings = computePlanSavings(revenue, orders, current, plan)
    if (savings === null || savings <= 0) continue
    if (!best || savings > best.savings) {
      best = { plan, savings }
    }
  }
  return best
}
