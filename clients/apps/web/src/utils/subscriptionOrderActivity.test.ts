import { describe, expect, it } from 'vitest'
import { withOrderActivity } from './subscriptionOrderActivity'
import { type SubscriptionActivityItem } from './subscriptionSummary'

const at = (value: string) => new Date(value).getTime()

const order = (
  id: string,
  created_at: string,
  billing_reason:
    | 'subscription_cycle'
    | 'subscription_update'
    | 'subscription_meter_cycle',
  status: 'paid' | 'refunded' | 'void' | 'pending' = 'paid',
) => ({ id, created_at, billing_reason, status })

const renewed: SubscriptionActivityItem = {
  kind: 'renewal',
  label: 'Renewed',
  at: at('2026-06-10T00:00:00Z'),
  upcoming: false,
  orderId: 'latest',
}

describe('withOrderActivity', () => {
  it('adds an event for every order no event stands for', () => {
    const activity = withOrderActivity(
      [renewed],
      [
        order('latest', '2026-06-10T00:00:05Z', 'subscription_cycle'),
        order('usage', '2026-05-20T00:00:00Z', 'subscription_meter_cycle'),
        order('change', '2026-05-12T00:00:00Z', 'subscription_update', 'void'),
        order('earlier', '2026-05-10T00:00:00Z', 'subscription_cycle'),
      ],
    )

    expect(activity.map(({ label, detail }) => [label, detail])).toEqual([
      ['Renewed', undefined],
      ['Usage billed', undefined],
      ['Plan changed', 'Voided'],
      ['Renewed', undefined],
    ])
  })

  it('says what became of an order an event already stands for', () => {
    const [item] = withOrderActivity(
      [renewed],
      [
        order(
          'latest',
          '2026-06-10T00:00:05Z',
          'subscription_cycle',
          'refunded',
        ),
      ],
    )

    expect(item.detail).toBe('Refunded')
  })

  it('leaves the payment attempts on an order to their own events', () => {
    const failed: SubscriptionActivityItem = {
      kind: 'failed',
      label: 'Payment failed',
      at: at('2026-06-10T00:01:00Z'),
      upcoming: false,
      orderId: 'latest',
      isPayment: true,
    }
    const activity = withOrderActivity(
      [failed],
      [
        order(
          'latest',
          '2026-06-10T00:00:05Z',
          'subscription_cycle',
          'pending',
        ),
      ],
    )

    expect(activity.map(({ label }) => label)).toEqual([
      'Payment failed',
      'Renewed',
    ])
  })
})
