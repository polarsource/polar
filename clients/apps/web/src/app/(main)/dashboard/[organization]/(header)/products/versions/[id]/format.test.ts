import { schemas } from '@polar-sh/client'
import { expect, it } from 'vitest'
import {
  customerEmailSettings,
  customFieldFields,
  meterFields,
  customerPortalSettings,
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

it('names settings like their config keys', () => {
  expect(
    settingsFields({
      payments: { currency: 'eur', tax: 'location' },
      subscriptions: {
        allow_multiple_subscriptions: true,
        prevent_trial_abuse: false,
        proration_behavior: 'next_period',
        benefit_revocation_grace_period: 7,
        trial_ended_reactivation_period: 14,
      },
      customer_portal: {
        allow_plan_changes: true,
        allow_unit_changes: false,
        allow_seat_management: false,
        allow_pausing: true,
        allow_email_changes: false,
        show_metered_usage: true,
      },
      customer_notifications: customerEmailSettings({
        order_confirmation: false,
        payment_method_expiration_reminder: false,
        subscription_cancellation: true,
        subscription_confirmation: true,
        subscription_cycled: true,
        subscription_cycled_after_trial: false,
        subscription_past_due: true,
        subscription_paused: true,
        subscription_resumed: true,
        subscription_renewal_reminder: true,
        subscription_revoked: true,
        subscription_trial_conversion_reminder: true,
        subscription_uncanceled: true,
        subscription_updated: true,
      }),
    }),
  ).toEqual({
    default_payment_currency: 'EUR',
    default_tax_behavior: 'Location based',
    allow_multiple_subscriptions: 'Yes',
    prevent_trial_abuse: 'No',
    proration_behavior: 'Schedule for next cycle',
    benefit_revocation_grace_period: 'After 7 Days',
    trial_ended_reactivation_period: 'After 14 Days',
    allow_plan_changes: 'Yes',
    allow_unit_changes: 'No',
    allow_seat_management: 'No',
    allow_pausing: 'Yes',
    allow_email_changes: 'No',
    show_metered_usage: 'Yes',
    send_order_confirmation: 'No',
    send_subscription_confirmation: 'Yes',
    send_trial_conversion_reminder: 'Yes',
    send_trial_converted: 'No',
    send_renewal_reminder: 'Yes',
    send_subscription_cycled: 'Yes',
    send_card_expiring: 'No',
    send_subscription_past_due: 'Yes',
    send_subscription_updated: 'Yes',
    send_subscription_paused: 'Yes',
    send_subscription_resumed: 'Yes',
    send_subscription_canceled: 'Yes',
    send_subscription_uncanceled: 'Yes',
    send_subscription_revoked: 'Yes',
  })
})

it('reads the organization customer portal settings with their defaults', () => {
  expect(
    customerPortalSettings({
      usage: { show: false },
      subscription: { update_plan: true, update_seats: true },
    }),
  ).toEqual({
    allow_plan_changes: true,
    allow_unit_changes: false,
    allow_seat_management: true,
    allow_pausing: false,
    allow_email_changes: false,
    show_metered_usage: false,
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
