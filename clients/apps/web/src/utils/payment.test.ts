import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { getPaymentDeclineMessage, getPaymentDisplayStatus } from './payment'

const payment = (
  overrides: Partial<schemas['GenericPayment']>,
): schemas['Payment'] =>
  ({
    status: 'failed',
    decline_reason: null,
    decline_message: null,
    ...overrides,
  }) as schemas['Payment']

describe('getPaymentDisplayStatus', () => {
  it.each(['rule', 'highest_risk_level', 'elevated_risk_level'])(
    'marks a %s decline as blocked',
    (decline_reason) => {
      expect(getPaymentDisplayStatus(payment({ decline_reason }))).toBe(
        'blocked',
      )
    },
  )

  it('keeps an issuer decline as failed', () => {
    expect(
      getPaymentDisplayStatus(payment({ decline_reason: 'do_not_honor' })),
    ).toBe('failed')
  })

  it('keeps a succeeded payment as succeeded', () => {
    expect(
      getPaymentDisplayStatus(
        payment({ status: 'succeeded', decline_reason: null }),
      ),
    ).toBe('succeeded')
  })
})

describe('getPaymentDeclineMessage', () => {
  it("replaces Stripe's rule message with Polar's", () => {
    expect(
      getPaymentDeclineMessage(
        payment({
          decline_reason: 'rule',
          decline_message: 'One of your rules blocked this payment.',
        }),
      ),
    ).toBe('Polar blocked this payment because of suspicious activity.')
  })

  it('falls back to the decline reason without a message', () => {
    expect(
      getPaymentDeclineMessage(payment({ decline_reason: 'do_not_honor' })),
    ).toBe('do_not_honor')
  })

  it('prefers the decline message', () => {
    expect(
      getPaymentDeclineMessage(
        payment({
          decline_reason: 'do_not_honor',
          decline_message: 'The bank returned the decline code `do_not_honor`.',
        }),
      ),
    ).toBe('The bank returned the decline code `do_not_honor`.')
  })
})
