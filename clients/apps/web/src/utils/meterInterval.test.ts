import { describe, expect, it } from 'vitest'
import {
  defaultMeterInterval,
  meterIntervalDividesBillingInterval,
} from './meterInterval'

describe('meterIntervalDividesBillingInterval', () => {
  it('accepts a monthly meter cycle on yearly billing', () => {
    expect(meterIntervalDividesBillingInterval('month', 1, 'year', 1)).toBe(
      true,
    )
    expect(meterIntervalDividesBillingInterval('month', 6, 'year', 1)).toBe(
      true,
    )
    expect(meterIntervalDividesBillingInterval('month', 8, 'year', 2)).toBe(
      true,
    )
  })

  it('rejects a monthly meter cycle that leaves a partial period', () => {
    expect(meterIntervalDividesBillingInterval('month', 5, 'year', 1)).toBe(
      false,
    )
  })

  it('accepts a meter cycle dividing the same interval unit', () => {
    expect(meterIntervalDividesBillingInterval('month', 2, 'month', 6)).toBe(
      true,
    )
    expect(meterIntervalDividesBillingInterval('day', 5, 'day', 10)).toBe(true)
    expect(meterIntervalDividesBillingInterval('week', 2, 'week', 4)).toBe(true)
  })

  it('rejects a meter cycle coarser than the billing cycle', () => {
    expect(meterIntervalDividesBillingInterval('year', 1, 'month', 6)).toBe(
      false,
    )
    expect(meterIntervalDividesBillingInterval('month', 12, 'month', 6)).toBe(
      false,
    )
  })

  it('converts days into weeks', () => {
    expect(meterIntervalDividesBillingInterval('day', 7, 'week', 1)).toBe(true)
    expect(meterIntervalDividesBillingInterval('day', 2, 'week', 2)).toBe(true)
    expect(meterIntervalDividesBillingInterval('day', 5, 'week', 1)).toBe(false)
  })

  it('only allows a daily meter cycle on month or year billing', () => {
    expect(meterIntervalDividesBillingInterval('day', 1, 'month', 1)).toBe(true)
    expect(meterIntervalDividesBillingInterval('day', 1, 'year', 1)).toBe(true)
    expect(meterIntervalDividesBillingInterval('day', 2, 'month', 1)).toBe(
      false,
    )
  })

  it('rejects week and month cycles across interval families', () => {
    expect(meterIntervalDividesBillingInterval('week', 1, 'month', 1)).toBe(
      false,
    )
    expect(meterIntervalDividesBillingInterval('month', 1, 'week', 4)).toBe(
      false,
    )
  })

  it('rejects counts that are not positive integers', () => {
    expect(meterIntervalDividesBillingInterval('month', 0, 'year', 1)).toBe(
      false,
    )
    expect(meterIntervalDividesBillingInterval('month', 1.5, 'year', 1)).toBe(
      false,
    )
    expect(meterIntervalDividesBillingInterval('month', 1, 'year', NaN)).toBe(
      false,
    )
  })
})

describe('defaultMeterInterval', () => {
  it('picks an interval that divides the billing interval', () => {
    expect(defaultMeterInterval('year')).toBe('month')
    expect(defaultMeterInterval('month')).toBe('month')
    expect(defaultMeterInterval('week')).toBe('day')
    expect(defaultMeterInterval('day')).toBe('day')
  })
})
