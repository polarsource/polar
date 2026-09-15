import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { MeterEvent, LedgerState } from '../src/api/generated'
import { emptyState, fold } from '../src/storage/balance'

const cases: {
  name: string
  events: MeterEvent[]
  credits: [string, number][]
  usage: [string, number][]
  until: string
  expected: LedgerState
}[] = JSON.parse(
  readFileSync(
    new URL('./fixtures/meter_reconciliation.json', import.meta.url),
    'utf8',
  ),
)
it.each(cases)(
  'matches the Python meter fold: $name',
  ({ events, credits, usage, until, expected }) => {
    const result = fold(
      emptyState(),
      events,
      credits.map(([t, v]) => [Date.parse(t), v]),
      usage.map(([t, v]) => [Date.parse(t), v]),
      Date.parse(until),
    )
    expect(result.credits).toBe(expected.credits)
    expect(result.usage).toBe(expected.usage)
    expect(result.boundary).toBe(
      expected.boundary ? Date.parse(expected.boundary) : null,
    )
    expect(result.boundaries).toEqual(expected.boundaries?.map(Date.parse))
    const cycles = Object.values(expected.cycles ?? {}).map((c) => ({
      ...c,
      period_start: new Date(c.period_start).toISOString(),
      period_end: new Date(c.period_end).toISOString(),
    }))
    expect([...result.cycles.values()]).toEqual(cycles)
  },
)
