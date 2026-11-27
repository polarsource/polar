import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { canRetryOrderPayment } from './order'

const order = (
  subscription: Partial<schemas['CustomerOrderSubscription']> | null,
): schemas['CustomerOrder'] =>
  ({
    status: 'pending',
    next_payment_attempt_at: '2026-11-28T00:00:00Z',
    subscription:
      subscription === null ? null : { ended_at: null, ...subscription },
  }) as schemas['CustomerOrder']

describe('canRetryOrderPayment', () => {
  it('allows a pending order of an active subscription', () => {
    expect(canRetryOrderPayment(order({}))).toBe(true)
  })

  it('refuses a pending order whose subscription has ended', () => {
    expect(
      canRetryOrderPayment(order({ ended_at: '2026-11-20T00:00:00Z' })),
    ).toBe(false)
  })

  it('refuses a pending order without a subscription', () => {
    expect(canRetryOrderPayment(order(null))).toBe(false)
  })
})
