import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  getCreditPreview,
  getMeterUnitLabel,
  MeterCreditOption,
  parseCreditUnits,
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
  it.each([
    ['1000', 1000],
    ['1,000', 1000],
    [' 25 000 ', 25000],
  ])('parses %j', (raw, expected) => {
    expect(parseCreditUnits(raw)).toBe(expected)
  })

  it.each(['', '0', '-5', '1.5', 'abc', '1000000001'])('rejects %j', (raw) => {
    expect(parseCreditUnits(raw)).toBeNull()
  })
})

describe('getMeterUnitLabel', () => {
  it('pluralizes the custom label', () => {
    expect(
      getMeterUnitLabel(meter({ unit: 'custom', custom_label: 'request' })),
    ).toBe('requests')
  })

  it('keeps a custom label that is already plural', () => {
    expect(
      getMeterUnitLabel(meter({ unit: 'custom', custom_label: 'credits' })),
    ).toBe('credits')
  })

  it('falls back to units for scalar meters', () => {
    expect(getMeterUnitLabel(meter())).toBe('units')
  })
})
