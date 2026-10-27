import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  formatCredits,
  getCreditPreview,
  MeterCreditOption,
  parseCreditUnits,
  validateCreditUnits,
} from './creditPreview'

const meter = (overrides: Partial<schemas['Meter']> = {}) =>
  ({
    id: 'meter_1',
    name: 'AI credits',
    unit: 'scalar',
    custom_label: null,
    custom_multiplier: null,
    ...overrides,
  }) as schemas['Meter']

const unitPrice = {
  amount_type: 'metered_unit',
  unit_amount: '1',
  cap_amount: null,
  price_currency: 'usd',
  meter_id: 'meter_1',
} as unknown as MeteredPrice

const option = (
  overrides: Partial<MeterCreditOption> = {},
): MeterCreditOption => ({
  meter: meter(),
  balance: 0,
  unitPrice,
  productName: 'Pro',
  ...overrides,
})

describe('getCreditPreview', () => {
  it('adds the credits to the current balance', () => {
    expect(getCreditPreview(option({ balance: 120 }), 1000).balanceAfter).toBe(
      1120,
    )
  })

  it('shows how much of the current overage the credits cover', () => {
    expect(getCreditPreview(option({ balance: -6250 }), 5000).overage).toEqual({
      before: 6250,
      after: 1250,
      currency: 'usd',
    })
  })

  it('drops the overage to zero once the balance is positive again', () => {
    expect(
      getCreditPreview(option({ balance: -6250 }), 7000).overage?.after,
    ).toBe(0)
  })

  it('has no overage line when there is no overage to cover', () => {
    expect(getCreditPreview(option({ balance: 300 }), 100).overage).toBeNull()
  })

  it('has no overage line when the meter is not billed', () => {
    expect(
      getCreditPreview(option({ balance: -500, unitPrice: null }), 100).overage,
    ).toBeNull()
  })
})

describe('parseCreditUnits', () => {
  it('accepts whole numbers with separators', () => {
    expect(parseCreditUnits('1000')).toBe(1000)
    expect(parseCreditUnits('1,000,000')).toBe(1_000_000)
    expect(parseCreditUnits(' 2 500 ')).toBe(2500)
  })

  it('rejects anything that is not a whole number in range', () => {
    expect(parseCreditUnits('')).toBeNull()
    expect(parseCreditUnits('1.5')).toBeNull()
    expect(parseCreditUnits('1e3')).toBeNull()
    expect(parseCreditUnits('-5')).toBeNull()
    expect(parseCreditUnits('0')).toBeNull()
    expect(parseCreditUnits('1000000001')).toBeNull()
  })
})

describe('validateCreditUnits', () => {
  it('explains why an amount is rejected', () => {
    expect(validateCreditUnits('')).toBe('Enter an amount')
    expect(validateCreditUnits('1.5')).toBe('Enter a whole number')
    expect(validateCreditUnits('0')).toBe('Enter at least 1 credit')
    expect(validateCreditUnits('2,000,000,000')).toBe(
      'Enter at most 1,000,000,000 credits',
    )
    expect(validateCreditUnits('1,000')).toBe(true)
  })
})

describe('formatCredits', () => {
  it('pluralizes', () => {
    expect(formatCredits(1)).toBe('1 credit')
    expect(formatCredits(1000)).toBe('1,000 credits')
  })
})
