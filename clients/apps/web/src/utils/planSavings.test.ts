import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  CurrentPlanContext,
  EARLY_MEMBER_FEE_FIXED,
  EARLY_MEMBER_FEE_PERCENT,
  EARLY_MEMBER_SUBSCRIPTION_SURCHARGE_BPS,
  computePlanSavings,
  isEarlyMember,
  monthlyPlanCost,
  pickBestPlanSavings,
} from './planSavings'

const plan = (
  overrides: Partial<schemas['OrganizationPlan']> & {
    name: string
    productId?: string | null
    priceAmount?: number | null
    recurringInterval?: string | null
    feePercent?: number | null
    feeFixed?: number | null
  },
): schemas['OrganizationPlan'] => {
  const {
    productId = `prod_${overrides.name}`,
    priceAmount = 2000,
    recurringInterval = 'month',
    feePercent = 380,
    feeFixed = 40,
    ...rest
  } = overrides
  return {
    product_id: productId,
    description: null,
    recurring_interval: recurringInterval,
    price:
      priceAmount === null ? null : { amount: priceAmount, currency: 'usd' },
    transaction_fee:
      feePercent === null || feeFixed === null
        ? null
        : { percent: feePercent, fixed: feeFixed },
    highlight: false,
    custom: false,
    features: [],
    ...rest,
  } as schemas['OrganizationPlan']
}

const subscription = (
  overrides: Partial<schemas['OrganizationSubscription']> & {
    subscriptionId?: string | null
    fee?: schemas['OrganizationPlanFee'] | null
  },
): schemas['OrganizationSubscription'] => {
  const {
    subscriptionId = null,
    fee = {
      percent: EARLY_MEMBER_FEE_PERCENT,
      fixed: EARLY_MEMBER_FEE_FIXED,
    },
    ...rest
  } = overrides
  return {
    subscription_id: subscriptionId,
    status: 'active',
    product_id: null,
    plan: plan({
      name: 'Early Member',
      productId: null,
      priceAmount: 0,
      recurringInterval: null,
      feePercent: fee?.percent ?? null,
      feeFixed: fee?.fixed ?? null,
    }),
    amount: 0,
    currency: 'usd',
    recurring_interval: null,
    recurring_interval_count: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    started_at: null,
    ends_at: null,
    pending_change: null,
    ...rest,
  } as schemas['OrganizationSubscription']
}

const STARTER: CurrentPlanContext = {
  fee: { percent: 500, fixed: 50 },
  subscriptionSurchargeBps: 0,
  subscriptionRevenue: 0,
}

const EARLY_MEMBER = (subscriptionRevenue: number): CurrentPlanContext => ({
  fee: { percent: EARLY_MEMBER_FEE_PERCENT, fixed: EARLY_MEMBER_FEE_FIXED },
  subscriptionSurchargeBps: EARLY_MEMBER_SUBSCRIPTION_SURCHARGE_BPS,
  subscriptionRevenue,
})

const PRO = plan({
  name: 'Pro',
  priceAmount: 2000,
  feePercent: 380,
  feeFixed: 40,
})
const GROWTH = plan({
  name: 'Growth',
  priceAmount: 10000,
  feePercent: 360,
  feeFixed: 35,
})
const SCALE = plan({
  name: 'Scale',
  priceAmount: 40000,
  feePercent: 340,
  feeFixed: 30,
})

describe('isEarlyMember', () => {
  it('matches subscription with no id and 4% + 40¢ fee', () => {
    expect(isEarlyMember(subscription({}))).toBe(true)
  })

  it('rejects when subscription_id is set', () => {
    expect(isEarlyMember(subscription({ subscriptionId: 'sub_123' }))).toBe(
      false,
    )
  })

  it('rejects Starter (5% + 50¢)', () => {
    expect(
      isEarlyMember(subscription({ fee: { percent: 500, fixed: 50 } })),
    ).toBe(false)
  })

  it('rejects when fixed fee is different', () => {
    expect(
      isEarlyMember(subscription({ fee: { percent: 400, fixed: 35 } })),
    ).toBe(false)
  })
})

describe('monthlyPlanCost', () => {
  it('returns the amount for monthly plans', () => {
    expect(monthlyPlanCost(PRO)).toBe(2000)
  })

  it('divides yearly plans by 12', () => {
    const yearly = plan({
      name: 'Yearly Pro',
      priceAmount: 24000,
      recurringInterval: 'year',
    })
    expect(monthlyPlanCost(yearly)).toBe(2000)
  })

  it('returns null for free plans (no price)', () => {
    const free = plan({ name: 'Free', priceAmount: 0 })
    expect(monthlyPlanCost(free)).toBeNull()
  })
})

describe('computePlanSavings', () => {
  it('returns null for free plans (no product_id)', () => {
    const free = plan({ name: 'Starter', productId: null, priceAmount: 0 })
    expect(computePlanSavings(100_000, 10, STARTER, free)).toBeNull()
  })

  it('returns null for plans missing a transaction_fee', () => {
    const broken = plan({ name: 'No-Fee', feePercent: null, feeFixed: null })
    expect(computePlanSavings(100_000, 10, STARTER, broken)).toBeNull()
  })

  it('returns null when paid plan does not lower percent fee', () => {
    const sameRate = plan({ name: 'Same', feePercent: 500, feeFixed: 40 })
    expect(computePlanSavings(100_000, 10, STARTER, sameRate)).toBeNull()
  })

  it('returns variable + fixed savings minus monthly plan cost', () => {
    // Starter (5% + 50¢) → Pro (3.8% + 40¢) at $1,000 / 10 orders:
    //   variable = 100_000 * 120 / 10000 = 1200
    //   fixed    = 10 * 10                = 100
    //   cost     = 2000
    //   savings  = 1200 + 100 - 2000      = -700
    expect(computePlanSavings(100_000, 10, STARTER, PRO)).toBe(-700)
  })

  it('returns positive savings past breakeven', () => {
    // Starter → Pro at $10,000 / 100 orders:
    //   variable = 1_000_000 * 120 / 10000 = 12000
    //   fixed    = 100 * 10                = 1000
    //   cost     = 2000
    //   savings  = 12000 + 1000 - 2000     = 11000
    expect(computePlanSavings(1_000_000, 100, STARTER, PRO)).toBe(11_000)
  })

  it('adds Early Member subscription surcharge savings against MRR', () => {
    // Early Member ($100k MRR) → Pro:
    //   variable           = 10_000_000 * 20 / 10000 = 20_000
    //   fixed              = 0 * 0                   = 0
    //   surcharge (0.5%)   = 10_000_000 * 50 / 10000 = 50_000
    //   cost               = 2000
    //   savings            = 20_000 + 0 + 50_000 - 2000 = 68_000
    expect(
      computePlanSavings(10_000_000, 0, EARLY_MEMBER(10_000_000), PRO),
    ).toBe(68_000)
  })

  it('does not add surcharge for non-Early-Member orgs', () => {
    // Same numbers as above but Starter (no surcharge):
    //   variable = 10_000_000 * 120 / 10000 = 120_000
    //   fixed    = 0 * 10                   = 0
    //   cost     = 2000
    //   savings  = 120_000 + 0 - 2000       = 118_000
    expect(computePlanSavings(10_000_000, 0, STARTER, PRO)).toBe(118_000)
  })

  it('treats yearly plans as price / 12 in the cost subtraction', () => {
    const yearlyPro = plan({
      name: 'Yearly Pro',
      priceAmount: 24_000,
      recurringInterval: 'year',
      feePercent: 380,
      feeFixed: 40,
    })
    // Same as monthly Pro case (yearly cost / 12 = 2000):
    expect(computePlanSavings(1_000_000, 100, STARTER, yearlyPro)).toBe(11_000)
  })
})

describe('pickBestPlanSavings', () => {
  const plans = [PRO, GROWTH, SCALE]

  it('returns null when no plan saves money', () => {
    expect(pickBestPlanSavings(100_000, 10, STARTER, plans)).toBeNull()
  })

  it('picks Growth for Starter at $10k revenue, 100 orders', () => {
    // Pro:    12000 + 1000 - 2000  = 11_000
    // Growth: 14000 + 1500 - 10000 = 5500
    // Scale:  16000 + 2000 - 40000 = -22000  (excluded)
    const result = pickBestPlanSavings(1_000_000, 100, STARTER, plans)
    expect(result?.plan.name).toBe('Pro')
    expect(result?.savings).toBe(11_000)
  })

  it('picks the plan with maximum savings even when several qualify', () => {
    // Starter at $100k / 2,500 orders (AOV $40):
    // Pro:    120_000 + 25_000  - 2000  = 143_000
    // Growth: 140_000 + 37_500  - 10000 = 167_500
    // Scale:  160_000 + 50_000  - 40000 = 170_000  ← best
    const result = pickBestPlanSavings(10_000_000, 2500, STARTER, plans)
    expect(result?.plan.name).toBe('Scale')
    expect(result?.savings).toBe(170_000)
  })

  it('picks Growth for Early Member at $100k MRR / no orders', () => {
    // Early Member ($100k MRR), 0 orders:
    // Pro:    20_000 + 0 + 50_000 - 2000  = 68_000
    // Growth: 40_000 + 0 + 50_000 - 10000 = 80_000  ← best
    // Scale:  60_000 + 0 + 50_000 - 40000 = 70_000
    const result = pickBestPlanSavings(
      10_000_000,
      0,
      EARLY_MEMBER(10_000_000),
      plans,
    )
    expect(result?.plan.name).toBe('Growth')
    expect(result?.savings).toBe(80_000)
  })
})
