import { describe, expect, it } from 'vitest'
import {
  AnySubscription,
  getChargePreviewMeta,
  getPauseAction,
  getScheduleRows,
} from './subscriptionState'

const subscription = (
  overrides: Partial<AnySubscription> = {},
): AnySubscription =>
  ({
    status: 'active',
    started_at: '2026-01-01T00:00:00Z',
    current_period_end: '2026-02-01T00:00:00Z',
    trial_end: null,
    ends_at: null,
    ended_at: null,
    paused_at: null,
    resumes_at: null,
    cancel_at_period_end: false,
    pause_at_period_end: false,
    ...overrides,
  }) as AnySubscription

describe('getPauseAction', () => {
  it('offers a pause on a running subscription', () => {
    expect(getPauseAction(subscription())).toBe('pause')
  })

  it('offers a resume once paused', () => {
    expect(getPauseAction(subscription({ status: 'paused' }))).toBe('resume')
  })

  it('offers to call off a scheduled pause', () => {
    expect(getPauseAction(subscription({ pause_at_period_end: true }))).toBe(
      'cancel_scheduled_pause',
    )
  })

  it('offers nothing once cancellation is scheduled', () => {
    expect(
      getPauseAction(subscription({ cancel_at_period_end: true })),
    ).toBeNull()
    expect(
      getPauseAction(
        subscription({ cancel_at_period_end: true, pause_at_period_end: true }),
      ),
    ).toBeNull()
  })

  it('offers nothing once the subscription has ended', () => {
    expect(
      getPauseAction(
        subscription({
          status: 'canceled',
          ended_at: '2026-01-15T00:00:00Z',
          pause_at_period_end: true,
        }),
      ),
    ).toBeNull()
  })

  it('offers nothing while incomplete', () => {
    expect(getPauseAction(subscription({ status: 'incomplete' }))).toBeNull()
  })
})

describe('getChargePreviewMeta', () => {
  it('bills at the end of the current period by default', () => {
    const meta = getChargePreviewMeta(subscription())
    expect(meta).toMatchObject({
      visible: true,
      chargeDate: '2026-02-01T00:00:00Z',
      title: 'Upcoming charge',
      dateLabel: 'Next invoice',
    })
  })

  it('bills at trial end while trialing', () => {
    const meta = getChargePreviewMeta(
      subscription({ status: 'trialing', trial_end: '2026-01-20T00:00:00Z' }),
    )
    expect(meta).toMatchObject({
      visible: true,
      chargeDate: '2026-01-20T00:00:00Z',
      title: 'First charge after trial',
      dateLabel: 'Trial ends',
    })
  })

  it('bills a final charge when canceling at period end', () => {
    const meta = getChargePreviewMeta(
      subscription({ cancel_at_period_end: true }),
    )
    expect(meta).toMatchObject({
      visible: true,
      title: 'Final charge',
      dateLabel: 'Subscription ends',
      isCancelingAtPeriodEnd: true,
    })
  })

  it('bills on the resume date when a pause has one', () => {
    const meta = getChargePreviewMeta(
      subscription({ status: 'paused', resumes_at: '2026-03-01T00:00:00Z' }),
    )
    expect(meta).toMatchObject({
      visible: true,
      chargeDate: '2026-03-01T00:00:00Z',
      title: 'Charge on resume',
      dateLabel: 'Resumes',
    })
  })

  it('hides while paused with no resume date', () => {
    expect(
      getChargePreviewMeta(subscription({ status: 'paused' })).visible,
    ).toBe(false)
    expect(
      getChargePreviewMeta(subscription({ pause_at_period_end: true })).visible,
    ).toBe(false)
  })

  it('treats a cancellation as outranking a scheduled pause', () => {
    const meta = getChargePreviewMeta(
      subscription({
        pause_at_period_end: true,
        resumes_at: '2026-03-01T00:00:00Z',
        cancel_at_period_end: true,
      }),
    )
    expect(meta.title).toBe('Final charge')
    expect(meta.chargeDate).toBe('2026-02-01T00:00:00Z')
  })

  it('hides once the subscription has ended', () => {
    expect(
      getChargePreviewMeta(
        subscription({ status: 'canceled', ended_at: '2026-01-15T00:00:00Z' }),
      ).visible,
    ).toBe(false)
  })
})

describe('getScheduleRows', () => {
  it('shows a renewal date while running', () => {
    expect(getScheduleRows(subscription())).toEqual([
      {
        key: 'next_event',
        label: 'Renewal date',
        datetime: '2026-02-01T00:00:00Z',
      },
    ])
  })

  it('relabels the renewal as a pause when one is scheduled', () => {
    const rows = getScheduleRows(subscription({ pause_at_period_end: true }))
    expect(rows.map((row) => row.label)).toEqual(['Pauses on', 'Resumes on'])
  })

  it('falls back to open-ended wording when a pause has no resume date', () => {
    const rows = getScheduleRows(subscription({ status: 'paused' }))
    expect(rows).toEqual([
      {
        key: 'resumes_at',
        label: 'Resumes on',
        datetime: null,
        fallback: 'Until resumed',
      },
    ])
  })

  it('drops the renewal row once paused', () => {
    const rows = getScheduleRows(
      subscription({ status: 'paused', paused_at: '2026-01-10T00:00:00Z' }),
    )
    expect(rows.map((row) => row.key)).toEqual(['paused_at', 'resumes_at'])
  })

  it('prefers an explicit end date over the period end', () => {
    const rows = getScheduleRows(
      subscription({ ends_at: '2026-01-25T00:00:00Z' }),
    )
    expect(rows).toEqual([
      {
        key: 'next_event',
        label: 'Ending date',
        datetime: '2026-01-25T00:00:00Z',
      },
    ])
  })

  it('shows only the end date once ended', () => {
    const rows = getScheduleRows(
      subscription({ status: 'canceled', ended_at: '2026-01-15T00:00:00Z' }),
    )
    expect(rows).toEqual([
      {
        key: 'ended_at',
        label: 'Ended',
        datetime: '2026-01-15T00:00:00Z',
      },
    ])
  })

  it('shows the trial end while trialing', () => {
    const rows = getScheduleRows(
      subscription({ status: 'trialing', trial_end: '2026-01-20T00:00:00Z' }),
    )
    expect(rows.map((row) => row.key)).toEqual(['trial_end', 'next_event'])
  })

  it('does not repeat the trial end as a renewal date', () => {
    // The API sets trial_end and current_period_end to the same value while
    // trialing, so both rows would show the same date.
    const rows = getScheduleRows(
      subscription({
        status: 'trialing',
        trial_end: '2026-02-01T00:00:00Z',
        current_period_end: '2026-02-01T00:00:00Z',
      }),
    )
    expect(rows).toEqual([
      {
        key: 'trial_end',
        label: 'Trial ends',
        datetime: '2026-02-01T00:00:00Z',
      },
    ])
  })
})
