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
  describe('flat rate', () => {
    it('multiplies units by the unit amount', () => {
      expect(estimateMeteredCost(price({ unit_amount: '0.5' }), 100)).toBe(50)
    })

    it('treats a missing unit amount as free', () => {
      expect(estimateMeteredCost(price({ unit_amount: null }), 100)).toBe(0)
    })
  })

  describe('zero and negative usage', () => {
    it.each([0, -1])('costs nothing for %i units', (units) => {
      expect(
        estimateMeteredCost(price({ tiers: ladder('graduated') }), units),
      ).toBe(0)
    })
  })

  describe('graduated', () => {
    it('bills a quantity inside the first tier at the first rate', () => {
      const p = price({ unit_amount: null, tiers: ladder('graduated') })
      expect(estimateMeteredCost(p, 500)).toBe(2500)
    })

    it('bills the boundary quantity entirely at the first rate', () => {
      const p = price({ unit_amount: null, tiers: ladder('graduated') })
      expect(estimateMeteredCost(p, 1000)).toBe(5000)
    })

    it('splits usage across tiers, each portion at its own rate', () => {
      const p = price({ unit_amount: null, tiers: ladder('graduated') })
      // 1,000 × 5c + 1,000 × 1c
      expect(estimateMeteredCost(p, 2000)).toBe(6000)
    })

    it('handles fractional usage', () => {
      const p = price({ unit_amount: null, tiers: ladder('graduated') })
      // 1,000 × 5c + 0.5 × 1c
      expect(estimateMeteredCost(p, 1000.5)).toBe(5000.5)
    })

    it('reads tiers that arrive unsorted', () => {
      const p = price({
        unit_amount: null,
        tiers: tiers('graduated', [
          { bound: null, unit_amount: '1' },
          { bound: 1000, unit_amount: '5' },
        ]),
      })
      expect(estimateMeteredCost(p, 2000)).toBe(6000)
    })
  })

  describe('volume', () => {
    it('bills the whole quantity at the rate of the tier it lands in', () => {
      const p = price({ unit_amount: null, tiers: ladder('volume') })
      expect(estimateMeteredCost(p, 500)).toBe(2500)
    })

    it('reprices the entire quantity once a bound is crossed', () => {
      const p = price({ unit_amount: null, tiers: ladder('volume') })
      // Not 1,000 × 5c + 1,000 × 1c — the whole 2,000 drops to the 1c rate.
      expect(estimateMeteredCost(p, 2000)).toBe(2000)
    })

    it('keeps the boundary quantity in the lower tier', () => {
      const p = price({ unit_amount: null, tiers: ladder('volume') })
      expect(estimateMeteredCost(p, 1000)).toBe(5000)
    })

    it('falls back to the top tier when usage passes every bound', () => {
      const p = price({
        unit_amount: null,
        tiers: tiers('volume', [
          { bound: 100, unit_amount: '10' },
          { bound: 200, unit_amount: '5' },
        ]),
      })
      expect(estimateMeteredCost(p, 500)).toBe(2500)
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
