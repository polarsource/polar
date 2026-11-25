import { describe, expect, it } from 'vitest'
import {
  getMonthlyRecurringAmount,
  getSubscriptionActivity,
  type ActivitySubscription,
} from './subscriptionSummary'

const NOW = new Date('2026-06-15T00:00:00Z').getTime()

const subscription = (
  overrides: Partial<ActivitySubscription> = {},
): ActivitySubscription => ({
  status: 'active',
  started_at: '2026-03-10T00:00:00Z',
  current_period_start: '2026-06-10T00:00:00Z',
  current_period_end: '2026-07-10T00:00:00Z',
  trial_start: null,
  trial_end: null,
  canceled_at: null,
  ends_at: null,
  ended_at: null,
  past_due_at: null,
  paused_at: null,
  resumes_at: null,
  pause_at_period_end: false,
  ...overrides,
})

const labels = (overrides: Partial<ActivitySubscription> = {}) =>
  getSubscriptionActivity(subscription(overrides), NOW).map(
    ({ label, upcoming }) => (upcoming ? `${label} (upcoming)` : label),
  )

describe('getSubscriptionActivity', () => {
  it('lists an active subscription newest first', () => {
    expect(labels()).toEqual(['Renews (upcoming)', 'Renewed', 'Subscribed'])
  })

  it('shows a converted trial', () => {
    expect(
      labels({
        trial_start: '2026-03-10T00:00:00Z',
        trial_end: '2026-03-24T00:00:00Z',
      }),
    ).toEqual([
      'Renews (upcoming)',
      'Renewed',
      'Trial converted',
      'Trial started',
    ])
  })

  it('shows a trial that ended without converting', () => {
    expect(
      labels({
        status: 'canceled',
        trial_start: '2026-03-10T00:00:00Z',
        trial_end: '2026-03-24T00:00:00Z',
        current_period_start: '2026-03-10T00:00:00Z',
        current_period_end: '2026-03-24T00:00:00Z',
        canceled_at: '2026-03-15T00:00:00Z',
        ends_at: '2026-03-24T00:00:00Z',
        ended_at: '2026-03-24T00:00:00Z',
      }),
    ).toEqual(['Ended', 'Cancellation requested', 'Trial started'])
  })

  it('shows a trial that ran out without a payment method', () => {
    expect(
      labels({
        status: 'trial_ended',
        trial_start: '2026-03-10T00:00:00Z',
        trial_end: '2026-03-24T00:00:00Z',
        current_period_start: '2026-03-10T00:00:00Z',
        current_period_end: '2026-03-24T00:00:00Z',
        ends_at: '2026-06-24T00:00:00Z',
      }),
    ).toEqual(['Ends (upcoming)', 'Trial ended', 'Trial started'])
  })

  it('shows a scheduled cancellation instead of a renewal', () => {
    expect(
      labels({
        canceled_at: '2026-06-12T00:00:00Z',
        ends_at: '2026-07-10T00:00:00Z',
      }),
    ).toEqual([
      'Ends (upcoming)',
      'Cancellation requested',
      'Renewed',
      'Subscribed',
    ])
  })

  it('shows when a paused subscription resumes', () => {
    expect(
      labels({
        status: 'paused',
        current_period_start: '2026-04-10T00:00:00Z',
        current_period_end: '2026-05-10T00:00:00Z',
        paused_at: '2026-05-10T00:00:00Z',
        resumes_at: '2026-08-01T00:00:00Z',
      }),
    ).toEqual(['Resumes (upcoming)', 'Paused', 'Subscribed'])
  })
})

describe('getMonthlyRecurringAmount', () => {
  const base = {
    status: 'active',
    amount: 12000,
    recurring_interval: 'year',
    recurring_interval_count: 1,
    ended_at: null,
  } as const

  it('normalizes a yearly amount to a month', () => {
    expect(getMonthlyRecurringAmount(base)).toBe(1000)
  })

  it('accounts for the interval count', () => {
    expect(
      getMonthlyRecurringAmount({
        ...base,
        recurring_interval: 'month',
        recurring_interval_count: 3,
      }),
    ).toBe(4000)
  })

  it('is null once the subscription stops recurring', () => {
    expect(getMonthlyRecurringAmount({ ...base, status: 'paused' })).toBeNull()
    expect(
      getMonthlyRecurringAmount({ ...base, ended_at: '2026-01-01T00:00:00Z' }),
    ).toBeNull()
  })
})

describe('getSubscriptionActivity orders', () => {
  const orders = [
    { id: 'renewal', created_at: '2026-06-10T00:00:05Z' },
    { id: 'first', created_at: '2026-03-10T00:00:02Z' },
  ]
  const dunning = {
    orderId: 'renewal',
    attempts: [
      {
        at: new Date('2026-06-11T00:00:00Z').getTime(),
        isRetry: false,
        reason: null,
      },
    ],
    nextAttemptAt: new Date('2026-06-16T00:00:00Z').getTime(),
    recoveredAt: null,
  }
  const links = (activity: ReturnType<typeof getSubscriptionActivity>) =>
    Object.fromEntries(
      activity.map(({ label, orderId, isPayment }) => [
        label,
        orderId ? `${orderId}${isPayment ? '#payments' : ''}` : null,
      ]),
    )

  it('links the first charge and the renewal to their orders', () => {
    expect(
      links(getSubscriptionActivity(subscription(), NOW, undefined, orders)),
    ).toEqual({ Renews: null, Renewed: 'renewal', Subscribed: 'first' })
  })

  it('links payment attempts to the payments of the order they were for', () => {
    expect(
      links(getSubscriptionActivity(subscription(), NOW, dunning, orders)),
    ).toMatchObject({
      'Payment failed': 'renewal#payments',
      'Payment retry': 'renewal#payments',
    })
  })

  it('leaves an event without an order near it unlinked', () => {
    expect(
      links(getSubscriptionActivity(subscription(), NOW, undefined, [])),
    ).toEqual({ Renews: null, Renewed: null, Subscribed: null })
  })
})
