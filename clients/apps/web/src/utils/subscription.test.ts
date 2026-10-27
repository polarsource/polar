import { describe, expect, it } from 'vitest'
import {
  billsUsageOnMeterCycle,
  getPauseAction,
  MeterCycleSubscription,
  PauseActionSubscription,
} from './subscription'

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

describe('billsUsageOnMeterCycle', () => {
  const meterCycleSubscription = (
    overrides: Partial<MeterCycleSubscription>,
  ): MeterCycleSubscription => ({
    status: 'active',
    current_period_end: '2027-01-01T00:00:00Z',
    current_meter_period_end: '2026-11-01T00:00:00Z',
    meters: [{}],
    ...overrides,
  })

  it('holds when the meter period ends before the billing period', () => {
    expect(billsUsageOnMeterCycle(meterCycleSubscription({}))).toBe(true)
  })

  it('does not hold when both periods end together', () => {
    expect(
      billsUsageOnMeterCycle(
        meterCycleSubscription({
          current_meter_period_end: '2027-01-01T00:00:00Z',
        }),
      ),
    ).toBe(false)
  })

  it('does not hold without a meter cycle', () => {
    expect(
      billsUsageOnMeterCycle(
        meterCycleSubscription({ current_meter_period_end: null }),
      ),
    ).toBe(false)
  })

  it('does not hold while paused', () => {
    expect(
      billsUsageOnMeterCycle(meterCycleSubscription({ status: 'paused' })),
    ).toBe(false)
  })

  it('does not hold without meters', () => {
    expect(billsUsageOnMeterCycle(meterCycleSubscription({ meters: [] }))).toBe(
      false,
    )
  })
})
