import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { valueFormatter } from './format'

const format = valueFormatter([
  {
    benefits: [],
    meters: [{ external_id: 'api', name: 'API calls' }],
  } as unknown as schemas['ConfigExportDocument'],
])

describe('valueFormatter', () => {
  it('lists every tier of a tiered price', () => {
    expect(
      format('prices', {
        amount_type: 'seat_based',
        price_currency: 'usd',
        tiers: {
          type: 'graduated',
          tiers: [
            { bound: 10, unit_amount: '1000' },
            { bound: null, unit_amount: '800' },
          ],
        },
        minimum_units: 3,
      }),
    ).toBe(
      'Graduated: $10.00 / seat up to 10, then $8.00 / seat, minimum 3 seats',
    )
  })

  it('names the meter and cap of a metered tiered price', () => {
    expect(
      format('prices', {
        amount_type: 'metered_tiers',
        price_currency: 'usd',
        meter: 'api',
        tiers: { type: 'volume', tiers: [{ bound: null, unit_amount: '5' }] },
        cap_amount: 10000,
      }),
    ).toBe('$0.05 / API calls, capped at $100')
  })
})
