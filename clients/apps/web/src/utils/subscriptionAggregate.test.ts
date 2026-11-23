import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { aggregateSubscriptions } from './subscriptionAggregate'

const time = (value: string) => new Date(value).getTime()

const NOW = time('2026-06-15T12:00:00')
const RANGE = {
  start: time('2026-05-01T00:00:00'),
  end: time('2026-08-31T00:00:00'),
}

const subscription = (
  overrides: Partial<schemas['Subscription']> = {},
): schemas['Subscription'] =>
  ({
    status: 'active',
    amount: 2000,
    currency: 'usd',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    started_at: '2026-03-10T12:00:00Z',
    current_period_start: '2026-06-10T12:00:00Z',
    current_period_end: '2026-07-10T12:00:00Z',
    trial_start: null,
    trial_end: null,
    ends_at: null,
    ended_at: null,
    paused_at: null,
    resumes_at: null,
    pause_at_period_end: false,
    product: { id: 'pro', name: 'Pro' },
    ...overrides,
  }) as schemas['Subscription']

const aggregate = (subscriptions: schemas['Subscription'][]) =>
  aggregateSubscriptions(subscriptions, {
    unit: 'month',
    range: RANGE,
    now: NOW,
    groupOf: ({ product }) => ({ key: product.id, label: product.name }),
  })

const months = (row: { buckets: { start: number }[] }) =>
  row.buckets.map(({ start }) => new Date(start).getMonth() + 1)

describe('aggregateSubscriptions', () => {
  it('sums one renewal per cycle into monthly buckets', () => {
    const [row] = aggregate([subscription(), subscription()])

    expect(months(row)).toEqual([5, 6, 7, 8])
    expect(row.subscriptions).toBe(2)
    expect(row.monthlyAmount).toBe(4000)
    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([2, 2, 2, 2])
    expect(row.buckets[2].renewingAmount).toBe(4000)
  })

  it('does not count a renewal for a trial that ran out unpaid', () => {
    const [row] = aggregate([
      subscription({
        status: 'trial_ended',
        started_at: '2026-06-01T12:00:00Z',
        trial_start: '2026-06-01T12:00:00Z',
        trial_end: '2026-06-08T12:00:00Z',
        current_period_start: '2026-06-01T12:00:00Z',
        current_period_end: '2026-06-08T12:00:00Z',
        ends_at: '2026-07-08T12:00:00Z',
      }),
    ])

    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([0, 0, 0, 0])
  })

  it('keeps currencies in rows of their own', () => {
    const rows = aggregate([
      subscription(),
      subscription({ currency: 'eur', amount: 1500 }),
      subscription({ currency: 'eur', amount: 1500 }),
    ])

    expect(
      rows.map(({ label, currency, monthlyAmount }) => [
        label,
        currency,
        monthlyAmount,
      ]),
    ).toEqual([
      ['Pro · EUR', 'eur', 3000],
      ['Pro · USD', 'usd', 2000],
    ])
    expect(new Set(rows.map(({ id }) => id)).size).toBe(2)
    expect(rows.every(({ key }) => key === 'pro')).toBe(true)
  })

  it('does not count the first charge as a renewal', () => {
    const [row] = aggregate([
      subscription({
        started_at: '2026-06-10T12:00:00Z',
        current_period_start: '2026-06-10T12:00:00Z',
      }),
    ])

    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([0, 0, 1, 1])
  })

  it('counts the charge that converts a trial', () => {
    const [row] = aggregate([
      subscription({
        status: 'trialing',
        started_at: '2026-06-10T12:00:00Z',
        trial_start: '2026-06-10T12:00:00Z',
        trial_end: '2026-06-24T12:00:00Z',
        current_period_start: '2026-06-10T12:00:00Z',
        current_period_end: '2026-06-24T12:00:00Z',
      }),
    ])

    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([0, 1, 1, 1])
  })

  it('puts a scheduled cancellation at risk and stops its renewals', () => {
    const [row] = aggregate([subscription({ ends_at: '2026-07-10T12:00:00Z' })])

    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([1, 1, 0, 0])
    expect(row.buckets[2]).toMatchObject({ atRisk: 1, atRiskAmount: 2000 })
  })

  it('treats upcoming charges of a past due subscription as at risk', () => {
    const [row] = aggregate([subscription({ status: 'past_due' })])

    expect(row.buckets.map(({ renewals }) => renewals)).toEqual([1, 1, 0, 0])
    expect(row.buckets.map(({ atRisk }) => atRisk)).toEqual([0, 0, 1, 1])
  })

  it('makes one row per group, largest first', () => {
    const rows = aggregate([
      subscription({
        amount: 900,
        product: { id: 'hobby', name: 'Hobby' } as schemas['Product'],
      }),
      subscription(),
    ])

    expect(rows.map(({ label }) => label)).toEqual(['Pro', 'Hobby'])
  })
})
