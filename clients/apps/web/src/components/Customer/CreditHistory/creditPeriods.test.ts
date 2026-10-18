import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { groupCreditsByPeriod } from './creditPeriods'

const credit = (
  id: string,
  timestamp: string,
  units: number,
  metadata: Partial<schemas['MeterCreditedMetadata']> = {},
) =>
  ({
    id,
    timestamp,
    name: 'meter.credited',
    metadata: {
      meter_id: 'meter',
      units,
      rollover: false,
      reason: 'benefit',
      ...metadata,
    },
  }) as schemas['MeterCreditEvent']

const reset = (id: string, timestamp: string) =>
  ({
    id,
    timestamp,
    name: 'meter.reset',
    metadata: { meter_id: 'meter' },
  }) as schemas['MeterResetEvent']

describe('groupCreditsByPeriod', () => {
  it('splits credits at meter resets, newest period first', () => {
    const periods = groupCreditsByPeriod([
      credit('c3', '2026-10-02T00:00:00Z', 1_000, { reason: 'manual' }),
      credit('c2', '2026-09-25T00:00:01Z', 25_000),
      reset('r2', '2026-09-25T00:00:00Z'),
      credit('c1', '2026-08-25T00:00:01Z', 5_000),
      reset('r1', '2026-08-25T00:00:00Z'),
    ])

    expect(periods).toMatchObject([
      { start: '2026-09-25T00:00:00Z', end: null, total: 26_000 },
      { start: '2026-08-25T00:00:00Z', end: '2026-09-25T00:00:00Z' },
    ])
    expect(periods[0].rows.map((row) => row.credit.id)).toEqual(['c3', 'c2'])
  })

  it('folds a loaded reversal into the credit it reverses', () => {
    const [period] = groupCreditsByPeriod([
      credit('rev', '2026-10-02T01:00:00Z', -500, {
        reason: 'manual',
        reversed_event_id: 'c1',
      }),
      credit('c1', '2026-10-02T00:00:00Z', 750, { reason: 'manual' }),
    ])

    expect(period.rows).toHaveLength(1)
    expect(period.rows[0]).toMatchObject({
      credit: { id: 'c1' },
      reversal: { id: 'rev' },
    })
    expect(period.total).toBe(250)
  })

  it('keeps a reversal whose credit is not loaded as its own row', () => {
    const [period] = groupCreditsByPeriod([
      credit('rev', '2026-10-02T01:00:00Z', -500, {
        reason: 'manual',
        reversed_event_id: 'older',
      }),
    ])

    expect(period.rows.map((row) => row.credit.id)).toEqual(['rev'])
  })

  it('drops periods without credits', () => {
    const periods = groupCreditsByPeriod([
      reset('r2', '2026-09-25T00:00:00Z'),
      credit('c1', '2026-08-25T00:00:01Z', 5_000),
    ])

    expect(periods).toHaveLength(1)
    expect(periods[0].end).toBe('2026-09-25T00:00:00Z')
  })
})
