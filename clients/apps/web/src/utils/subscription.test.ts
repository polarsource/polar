import { describe, expect, it } from 'vitest'
import { getPauseAction, PauseActionSubscription } from './subscription'

const subscription = (
  overrides: Partial<PauseActionSubscription>,
): PauseActionSubscription => ({
  status: 'active',
  pause_at_period_end: false,
  cancel_at_period_end: false,
  ended_at: null,
  ...overrides,
})

describe('getPauseAction', () => {
  it('offers a pause on an active subscription', () => {
    expect(getPauseAction(subscription({}))).toBe('pause')
  })

  it('offers a resume on a paused subscription', () => {
    expect(getPauseAction(subscription({ status: 'paused' }))).toBe('resume')
  })

  it('offers to cancel a pause scheduled on an active subscription', () => {
    expect(getPauseAction(subscription({ pause_at_period_end: true }))).toBe(
      'cancel_scheduled_pause',
    )
  })

  it('offers nothing on a past due subscription with a scheduled pause', () => {
    expect(
      getPauseAction(
        subscription({ status: 'past_due', pause_at_period_end: true }),
      ),
    ).toBeNull()
  })

  it('offers nothing on a subscription scheduled to cancel', () => {
    expect(
      getPauseAction(
        subscription({ cancel_at_period_end: true, pause_at_period_end: true }),
      ),
    ).toBeNull()
  })

  it('offers nothing on an ended subscription', () => {
    expect(
      getPauseAction(
        subscription({ status: 'canceled', ended_at: '2026-08-12T00:00:00Z' }),
      ),
    ).toBeNull()
  })
})
