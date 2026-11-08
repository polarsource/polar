import { expect, it } from 'vitest'
import { valueFormatter } from './format'

it('lists every tier of a tiered price', () => {
  expect(
    valueFormatter([])('prices', {
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
