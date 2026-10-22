import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  annualMonthsFree,
  availablePlanIntervals,
  defaultPlanInterval,
  filterPlansByInterval,
  isIntervalSwitch,
} from './planIntervals'

const plan = (
  tier: string,
  recurringInterval: string | null,
  amount: number,
): schemas['OrganizationPlan'] => ({
  product_id: recurringInterval ? `prod_${tier}_${recurringInterval}` : null,
  name: tier,
  tier,
  description: null,
  recurring_interval: recurringInterval,
  price: { amount, currency: 'usd' },
  transaction_fee: null,
  highlight: false,
  custom: false,
  features: [],
})

const free = plan('Free', null, 0)
const proMonthly = plan('Pro', 'month', 2000)
const proAnnual = plan('Pro', 'year', 22000)
const scaleMonthly = plan('Scale', 'month', 10000)

describe('availablePlanIntervals', () => {
  it('lists the intervals offered, in display order', () => {
    expect(availablePlanIntervals([free, proAnnual, proMonthly])).toEqual([
      'month',
      'year',
    ])
  })

  it('ignores the interval-less free plan', () => {
    expect(availablePlanIntervals([free, proMonthly])).toEqual(['month'])
  })
})

describe('defaultPlanInterval', () => {
  it('uses the first preferred interval that is available', () => {
    expect(defaultPlanInterval(['month', 'year'], [null, 'year'])).toBe('year')
  })

  it('skips preferred intervals that are not available', () => {
    expect(defaultPlanInterval(['month'], ['year'])).toBe('month')
  })

  it('falls back to monthly when nothing is available', () => {
    expect(defaultPlanInterval([], [])).toBe('month')
  })
})

describe('filterPlansByInterval', () => {
  it('keeps the free plan and the plans for the interval', () => {
    expect(
      filterPlansByInterval(
        [free, proMonthly, proAnnual, scaleMonthly],
        'year',
      ),
    ).toEqual([free, proAnnual])
  })
})

describe('isIntervalSwitch', () => {
  it('is true for the same tier on another interval', () => {
    expect(isIntervalSwitch(proMonthly, proAnnual)).toBe(true)
  })

  it('is false across tiers', () => {
    expect(isIntervalSwitch(proAnnual, scaleMonthly)).toBe(false)
  })

  it('is false from the free plan', () => {
    expect(isIntervalSwitch(free, proAnnual)).toBe(false)
  })
})

describe('annualMonthsFree', () => {
  it('counts the monthly payments the annual price saves', () => {
    expect(annualMonthsFree(proAnnual, [proMonthly, proAnnual])).toBe(1)
  })

  it('is null without a monthly equivalent', () => {
    expect(annualMonthsFree(proAnnual, [proAnnual])).toBeNull()
  })

  it('is null for monthly plans', () => {
    expect(annualMonthsFree(proMonthly, [proMonthly, proAnnual])).toBeNull()
  })

  it('is null when the annual plan is not cheaper', () => {
    const pricey = plan('Pro', 'year', 30000)
    expect(annualMonthsFree(pricey, [proMonthly, pricey])).toBeNull()
  })
})
