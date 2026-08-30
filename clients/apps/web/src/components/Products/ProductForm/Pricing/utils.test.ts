import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { estimateMeteredCost, shouldShowMeterCycle } from './utils'

type MeteredPrice = schemas['ProductPriceMeteredUnit']
type MeteredTiers = NonNullable<MeteredPrice['tiers']>

const price = (overrides: Partial<MeteredPrice> = {}): MeteredPrice =>
  ({
    id: 'price_1',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    is_archived: false,
    product_id: 'prod_1',
    amount_type: 'metered_unit',
    price_currency: 'usd',
    unit_amount: '0.05',
    tiers: null,
    cap_amount: null,
    meter_id: 'meter_1',
    meter: {
      id: 'meter_1',
      name: 'API Calls',
      unit: 'scalar',
      custom_label: null,
      custom_multiplier: null,
    },
    ...overrides,
  }) as MeteredPrice

const tiers = (
  tierType: MeteredTiers['type'],
  list: { bound: number | null; unit_amount: string }[],
): MeteredTiers => ({ type: tierType, tiers: list })

// The ladder used across the tiered cases: 5c up to 1,000, then 1c.
const ladder = (tierType: MeteredTiers['type']) =>
  tiers(tierType, [
    { bound: 1000, unit_amount: '5' },
    { bound: null, unit_amount: '1' },
  ])

describe('estimateMeteredCost', () => {
  it('multiplies units by a flat unit amount', () => {
    expect(estimateMeteredCost(price({ unit_amount: '0.5' }), 100)).toBe(50)
  })

  it.each([0, -1])('costs nothing for %i units', (units) => {
    expect(
      estimateMeteredCost(price({ tiers: ladder('graduated') }), units),
    ).toBe(0)
  })

  describe('graduated', () => {
    it.each([
      { position: 'inside the first tier', units: 500, expected: 2500 },
      { position: 'at the tier boundary', units: 1000, expected: 5000 },
      { position: 'across tiers', units: 2000, expected: 6000 },
      {
        position: 'with fractional usage',
        units: 1000.5,
        expected: 5000.5,
      },
    ])('bills usage $position', ({ units, expected }) => {
      const p = price({ unit_amount: null, tiers: ladder('graduated') })
      expect(estimateMeteredCost(p, units)).toBe(expected)
    })
  })

  describe('volume', () => {
    it.each([
      { position: 'inside the first tier', units: 500, expected: 2500 },
      { position: 'at the tier boundary', units: 1000, expected: 5000 },
      { position: 'after crossing the boundary', units: 2000, expected: 2000 },
    ])('bills the whole quantity $position', ({ units, expected }) => {
      const p = price({ unit_amount: null, tiers: ladder('volume') })
      expect(estimateMeteredCost(p, units)).toBe(expected)
    })
  })

  describe('single unbounded tier', () => {
    it('behaves like a flat rate', () => {
      const p = price({
        unit_amount: null,
        tiers: tiers('graduated', [{ bound: null, unit_amount: '5' }]),
      })
      expect(estimateMeteredCost(p, 250)).toBe(1250)
    })
  })

  describe('cap amount', () => {
    it('caps a tiered cost', () => {
      const p = price({
        unit_amount: null,
        tiers: ladder('graduated'),
        cap_amount: 1000,
      })
      expect(estimateMeteredCost(p, 2000)).toBe(1000)
    })

    it('honours a zero cap, matching the server', () => {
      const p = price({ unit_amount: '0.5', cap_amount: 0 })
      expect(estimateMeteredCost(p, 100)).toBe(0)
    })
  })
})

const base = {
  isEnabledForOrganization: true,
  isRecurring: true,
  hasMeteredPrice: false,
  hasMeterCreditBenefit: false,
  hasSavedMeterCycle: false,
}

describe('shouldShowMeterCycle', () => {
  it('stays hidden on a recurring product with nothing metered', () => {
    expect(shouldShowMeterCycle(base)).toBe(false)
  })

  it('shows once a metered price is added', () => {
    expect(shouldShowMeterCycle({ ...base, hasMeteredPrice: true })).toBe(true)
  })

  it('shows for a meter-credit benefit without any metered price', () => {
    expect(shouldShowMeterCycle({ ...base, hasMeterCreditBenefit: true })).toBe(
      true,
    )
  })

  it('stays hidden for an organization without the feature', () => {
    expect(
      shouldShowMeterCycle({
        ...base,
        isEnabledForOrganization: false,
        hasMeteredPrice: true,
        hasMeterCreditBenefit: true,
      }),
    ).toBe(false)
  })

  it('shows a saved meter cycle even once its trigger is gone', () => {
    expect(shouldShowMeterCycle({ ...base, hasSavedMeterCycle: true })).toBe(
      true,
    )
  })

  it('shows a saved meter cycle even if the feature is turned back off', () => {
    expect(
      shouldShowMeterCycle({
        ...base,
        isEnabledForOrganization: false,
        hasSavedMeterCycle: true,
      }),
    ).toBe(true)
  })

  it('stays hidden on a one-time product', () => {
    expect(
      shouldShowMeterCycle({
        isEnabledForOrganization: true,
        isRecurring: false,
        hasMeteredPrice: true,
        hasMeterCreditBenefit: true,
        hasSavedMeterCycle: true,
      }),
    ).toBe(false)
  })
})
