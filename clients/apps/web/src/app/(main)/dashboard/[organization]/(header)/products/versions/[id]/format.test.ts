import { expect, it } from 'vitest'
import { meterFields, valueFormatter } from './format'

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

it('reads a meter filter and aggregation as one line each', () => {
  expect(
    meterFields({
      external_id: 'tokens',
      name: 'Tokens',
      unit: 'token',
      custom_label: null,
      custom_multiplier: null,
      filter: {
        conjunction: 'and',
        clauses: [
          { property: 'name', operator: 'eq', value: 'completion' },
          {
            conjunction: 'or',
            clauses: [
              { property: 'metadata.model', operator: 'like', value: 'gpt' },
              { property: 'metadata.model', operator: 'like', value: 'claude' },
            ],
          },
        ],
      },
      aggregation: { func: 'sum', property: 'metadata.tokens' },
      metadata: {},
    }),
  ).toMatchObject({
    name: 'Tokens',
    filter:
      'Name equals completion and (model contains gpt or model contains claude)',
    aggregation: 'Sum of tokens',
  })
})
