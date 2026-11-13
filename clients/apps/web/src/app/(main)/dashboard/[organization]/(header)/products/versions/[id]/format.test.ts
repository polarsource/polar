import { schemas } from '@polar-sh/client'
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

it('prices a token meter per million tokens', () => {
  const format = valueFormatter([
    {
      benefits: [],
      meters: [{ external_id: 'tokens', name: 'LLM usage', unit: 'token' }],
    } as unknown as schemas['ConfigExportDocument'],
  ])
  expect(
    format('prices', {
      amount_type: 'metered_unit',
      price_currency: 'usd',
      meter: 'tokens',
      unit_amount: '0.000015',
      cap_amount: null,
    }),
  ).toBe('$0.15 / 1M tokens (LLM usage)')
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
