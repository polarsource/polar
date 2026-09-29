import { describe, expect, it } from 'vitest'
import {
  expectedStripeKeyMode,
  parseMissingStripeScopes,
  REQUIRED_PERMISSIONS,
  stripeCreateKeyUrl,
  stripeKeyError,
  stripeKeyPlaceholder,
} from './stripeKey'

describe('expectedStripeKeyMode', () => {
  it('requires live keys only in production', () => {
    expect(expectedStripeKeyMode('production')).toBe('live')
    expect(expectedStripeKeyMode('sandbox')).toBe('test')
    expect(expectedStripeKeyMode('development')).toBe('test')
  })
})

describe('stripeKeyPlaceholder', () => {
  it('matches the environment prefix', () => {
    expect(stripeKeyPlaceholder('live')).toBe('rk_live_...')
    expect(stripeKeyPlaceholder('test')).toBe('rk_test_...')
  })
})

describe('stripeCreateKeyUrl', () => {
  it('opens Stripe in the matching mode', () => {
    expect(stripeCreateKeyUrl('live')).toBe(
      'https://dashboard.stripe.com/apikeys/create',
    )
    expect(stripeCreateKeyUrl('test')).toBe(
      'https://dashboard.stripe.com/test/apikeys/create',
    )
  })
})

describe('REQUIRED_PERMISSIONS', () => {
  it('requires Connect → Accounts Read', () => {
    expect(REQUIRED_PERMISSIONS).toContainEqual(
      expect.objectContaining({
        group: 'Connect',
        resource: 'Accounts',
        access: 'Read',
      }),
    )
  })

  it('lists only rows that exist in Stripe’s key form', () => {
    const resources = REQUIRED_PERMISSIONS.map((p) => p.resource)
    expect(resources).not.toContain('Subscription schedules')
    expect(resources).not.toContain('All accounts')
    expect(REQUIRED_PERMISSIONS).toContainEqual(
      expect.objectContaining({
        group: 'Billing',
        resource: 'Subscriptions',
        access: 'Write',
      }),
    )
  })
})

describe('stripeKeyError', () => {
  it('leaves empty values to the submit-disabled path', () => {
    expect(stripeKeyError('', 'test')).toBeNull()
    expect(stripeKeyError('   ', 'live')).toBeNull()
  })

  it('rejects keys that are not Stripe secret or restricted keys', () => {
    expect(stripeKeyError('pk_test_abc', 'test')).toMatch(/rk_test_/)
    expect(stripeKeyError('not-a-key', 'live')).toMatch(/rk_live_/)
    expect(stripeKeyError('rk_invalid_abc', 'test')).toMatch(/rk_test_/)
    expect(stripeKeyError('rk_sandbox_abc', 'live')).toMatch(/rk_live_/)
  })

  it('rejects a live key in a test environment', () => {
    expect(stripeKeyError('rk_live_abc', 'test')).toMatch(/test-mode/)
    expect(stripeKeyError('sk_live_abc', 'test')).toMatch(/rk_test_/)
  })

  it('rejects a test key in production', () => {
    expect(stripeKeyError('rk_test_abc', 'live')).toMatch(/live-mode/)
  })

  it('accepts matching restricted and secret keys', () => {
    expect(stripeKeyError('rk_test_abc', 'test')).toBeNull()
    expect(stripeKeyError('sk_test_abc', 'test')).toBeNull()
    expect(stripeKeyError('rk_live_abc', 'live')).toBeNull()
    expect(stripeKeyError('sk_live_abc', 'live')).toBeNull()
  })
})

describe('parseMissingStripeScopes', () => {
  it('maps MissingStripeScopes labels onto the permission list', () => {
    expect(
      parseMissingStripeScopes({
        error: 'MissingStripeScopes',
        detail: 'The Stripe API key is missing access to: Accounts.',
      }),
    ).toEqual(['Accounts'])
    expect(
      parseMissingStripeScopes({
        error: 'MissingStripeScopes',
        detail:
          'The Stripe API key is missing access to: Customers, Subscriptions (write), Payment Methods, Accounts.',
      }),
    ).toEqual(['Customers', 'Subscriptions', 'Payment Methods', 'Accounts'])
  })

  it('maps labels from older API versions onto the current rows', () => {
    expect(
      parseMissingStripeScopes({
        error: 'MissingStripeScopes',
        detail:
          'The Stripe API key is missing access to: Subscription schedules, Promotion codes, All accounts.',
      }),
    ).toEqual(['Subscriptions', 'Promotion Codes', 'Accounts'])
  })

  it('ignores other API errors', () => {
    expect(
      parseMissingStripeScopes({
        error: 'SourceKeyModeMismatch',
        detail:
          'This Polar environment needs a test-mode Stripe key (e.g. `rk_test_…`), so the migration runs against test data.',
      }),
    ).toEqual([])
    expect(parseMissingStripeScopes({ detail: 'Not permitted' })).toEqual([])
  })
})
