import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  getSubscriptionTimeline,
  getTimelineStart,
  type TimelineSubscription,
} from './subscriptionTimeline'

const time = (value: string) => new Date(value).getTime()

const NOW = time('2026-06-15T00:00:00Z')
const HORIZON = time('2026-09-01T00:00:00Z')

const subscription = (
  overrides: Partial<TimelineSubscription> = {},
): TimelineSubscription => ({
  status: 'active',
  recurring_interval: 'month',
  recurring_interval_count: 1,
  started_at: '2026-03-10T00:00:00Z',
  current_period_start: '2026-06-10T00:00:00Z',
  current_period_end: '2026-07-10T00:00:00Z',
  trial_start: null,
  trial_end: null,
  ends_at: null,
  ended_at: null,
  paused_at: null,
  resumes_at: null,
  pause_at_period_end: false,
  ...overrides,
})

const timeline = (
  overrides: Partial<TimelineSubscription> = {},
  minCycleDuration = 0,
) =>
  getSubscriptionTimeline(subscription(overrides), {
    now: NOW,
    horizon: HORIZON,
    minCycleDuration,
  })

describe('getSubscriptionTimeline', () => {
  it('splits a renewing subscription into past, current and upcoming cycles', () => {
    const { start, segments, marker } = timeline()

    expect(start).toBe(time('2026-03-10T00:00:00Z'))
    expect(segments.map(({ kind }) => kind)).toEqual([
      'past',
      'past',
      'past',
      'current',
      'upcoming',
      'upcoming',
    ])
    expect(segments[3]).toEqual({
      kind: 'current',
      start: time('2026-06-10T00:00:00Z'),
      end: time('2026-07-10T00:00:00Z'),
    })
    expect(segments.at(-1)?.end).toBe(HORIZON)
    expect(marker).toBeNull()
  })

  it('stops at the scheduled end when canceling at period end', () => {
    const { segments, marker } = timeline({
      ends_at: '2026-07-10T00:00:00Z',
    })

    expect(segments.at(-1)).toMatchObject({
      kind: 'current',
      end: time('2026-07-10T00:00:00Z'),
    })
    expect(marker).toEqual({ kind: 'ending', at: time('2026-07-10T00:00:00Z') })
  })

  it('ends an ended subscription mid-cycle', () => {
    const { segments, marker } = timeline({
      status: 'canceled',
      current_period_start: '2026-05-10T00:00:00Z',
      current_period_end: '2026-06-10T00:00:00Z',
      ended_at: '2026-05-20T00:00:00Z',
    })

    expect(segments.map(({ kind }) => kind)).toEqual(['past', 'past', 'past'])
    expect(segments.at(-1)?.end).toBe(time('2026-05-20T00:00:00Z'))
    expect(marker).toEqual({ kind: 'ended', at: time('2026-05-20T00:00:00Z') })
  })

  it('leads with the trial and bills from its end', () => {
    const { segments } = timeline({
      status: 'trialing',
      started_at: '2026-06-08T00:00:00Z',
      trial_start: '2026-06-08T00:00:00Z',
      trial_end: '2026-06-22T00:00:00Z',
      current_period_start: '2026-06-08T00:00:00Z',
      current_period_end: '2026-06-22T00:00:00Z',
    })

    expect(segments[0]).toEqual({
      kind: 'trial',
      start: time('2026-06-08T00:00:00Z'),
      end: time('2026-06-22T00:00:00Z'),
    })
    expect(segments[1]).toEqual({
      kind: 'upcoming',
      start: time('2026-06-22T00:00:00Z'),
      end: time('2026-07-22T00:00:00Z'),
    })
  })

  it('follows a pause with a paused segment up to the resume date', () => {
    const { segments, marker } = timeline({
      status: 'paused',
      paused_at: '2026-06-10T00:00:00Z',
      resumes_at: '2026-08-01T00:00:00Z',
    })

    expect(segments.at(-1)).toEqual({
      kind: 'paused',
      start: time('2026-06-10T00:00:00Z'),
      end: time('2026-08-01T00:00:00Z'),
    })
    expect(segments.some(({ kind }) => kind === 'upcoming')).toBe(false)
    expect(marker).toEqual({
      kind: 'resuming',
      at: time('2026-08-01T00:00:00Z'),
    })
  })

  it('does not project cycles past a scheduled pause', () => {
    const { segments, marker } = timeline({ pause_at_period_end: true })

    expect(segments.at(-1)?.kind).toBe('current')
    expect(marker).toEqual({
      kind: 'pausing',
      at: time('2026-07-10T00:00:00Z'),
    })
  })

  it('honors the interval count', () => {
    const { segments } = timeline({
      recurring_interval_count: 3,
      started_at: '2025-12-10T00:00:00Z',
      current_period_end: '2026-09-10T00:00:00Z',
    })

    expect(segments.slice(0, 3)).toEqual([
      {
        kind: 'past',
        start: time('2025-12-10T00:00:00Z'),
        end: time('2026-03-10T00:00:00Z'),
      },
      {
        kind: 'past',
        start: time('2026-03-10T00:00:00Z'),
        end: time('2026-06-10T00:00:00Z'),
      },
      {
        kind: 'current',
        start: time('2026-06-10T00:00:00Z'),
        end: time('2026-09-10T00:00:00Z'),
      },
    ])
  })

  it('merges cycles that are too short to draw', () => {
    const { segments } = timeline({}, 60 * DAY_MS)

    expect(segments.map(({ kind }) => kind)).toEqual([
      'past',
      'current',
      'upcoming',
    ])
    expect(segments[0]).toMatchObject({
      start: time('2026-03-10T00:00:00Z'),
      end: time('2026-06-10T00:00:00Z'),
    })
  })
})

describe('getTimelineStart', () => {
  it('starts a month before the floor when nothing is earlier', () => {
    expect(
      getTimelineStart([subscription()], time('2026-02-14T00:00:00Z')),
    ).toBeLessThan(time('2026-01-15T00:00:00Z'))
  })

  it('stretches back to a subscription that predates the floor', () => {
    const start = getTimelineStart(
      [subscription({ started_at: '2024-01-20T00:00:00Z' })],
      time('2026-02-14T00:00:00Z'),
    )

    expect(start).toBeLessThanOrEqual(time('2024-01-01T00:00:00Z'))
    expect(start).toBeGreaterThan(time('2023-11-15T00:00:00Z'))
  })
})
