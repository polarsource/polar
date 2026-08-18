import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { estimateMeteredCost } from './utils'

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
  tier_type: MeteredTiers['tier_type'],
  list: { up_to: number | null; price_per_unit: string }[],
): MeteredTiers => ({ tier_type, tiers: list })

// The ladder used across the tiered cases: 5c up to 1,000, then 1c.
const ladder = (tier_type: MeteredTiers['tier_type']) =>
  tiers(tier_type, [
    { up_to: 1000, price_per_unit: '5' },
    { up_to: null, price_per_unit: '1' },
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
    it.each([0, -1, -1000])('costs nothing for %i units', (units) => {
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

    it('walks more than two tiers', () => {
      const p = price({
        unit_amount: null,
        tiers: tiers('graduated', [
          { up_to: 100, price_per_unit: '10' },
          { up_to: 200, price_per_unit: '5' },
          { up_to: null, price_per_unit: '1' },
        ]),
      })
      // 100 × 10c + 100 × 5c + 50 × 1c
      expect(estimateMeteredCost(p, 250)).toBe(1550)
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
          { up_to: null, price_per_unit: '1' },
          { up_to: 1000, price_per_unit: '5' },
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
          { up_to: 100, price_per_unit: '10' },
          { up_to: 200, price_per_unit: '5' },
        ]),
      })
      expect(estimateMeteredCost(p, 500)).toBe(2500)
    })
  })

  describe('single unbounded tier', () => {
    it('behaves like a flat rate', () => {
      const p = price({
        unit_amount: null,
        tiers: tiers('graduated', [{ up_to: null, price_per_unit: '5' }]),
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

    it('leaves a cost below the cap alone', () => {
      const p = price({
        unit_amount: null,
        tiers: ladder('graduated'),
        cap_amount: 100_000,
      })
      expect(estimateMeteredCost(p, 2000)).toBe(6000)
    })

    it('honours a zero cap, matching the server', () => {
      const p = price({ unit_amount: '0.5', cap_amount: 0 })
      expect(estimateMeteredCost(p, 100)).toBe(0)
    })
  })
})
