import { schemas } from '@polar-sh/client'
import { expect, it } from 'vitest'
import {
  customFieldFields,
  meterFields,
  settingsFields,
  valueFormatter,
} from './format'

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

it('names settings like the payment settings page', () => {
  expect(
    settingsFields({ payments: { currency: 'eur', tax: 'location' } }),
  ).toEqual({
    default_payment_currency: 'EUR',
    default_tax_behavior: 'Location based',
  })
})

it('reads a custom field by slug, with its bounds as minimum and maximum', () => {
  const field = {
    slug: 'seats',
    name: 'Seats',
    type: 'number',
    properties: { form_label: 'How many seats?', ge: 1, le: 50 },
    metadata: {},
  } as const
  expect(customFieldFields(field)).toMatchObject({
    external_id: 'seats',
    name: 'Seats',
    form_label: 'How many seats?',
    minimum: 1,
    maximum: 50,
  })
  const format = valueFormatter([
    {
      benefits: [],
      meters: [],
      custom_fields: [field],
    } as unknown as schemas['ConfigExportDocument'],
  ])
  expect(format('custom_fields', { field: 'seats', required: true })).toBe(
    'Seats',
  )
  expect(format('custom_fields', { field: 'seats', required: false })).toBe(
    'Seats, optional',
  )
  expect(format('options', { value: 'pro', label: 'Pro plan' })).toBe(
    'Pro plan (pro)',
  )
})

it('reads the bounds of a date custom field as dates', () => {
  expect(
    customFieldFields({
      slug: 'go_live',
      name: 'Go-live date',
      type: 'date',
      properties: { ge: 1793491200, le: 1830211200 },
      metadata: {},
    }),
  ).toMatchObject({ minimum: '2026-11-01', maximum: '2027-12-31' })
})
