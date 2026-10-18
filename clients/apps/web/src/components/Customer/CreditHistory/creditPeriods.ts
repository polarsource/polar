import { schemas } from '@polar-sh/client'

type Credit = schemas['MeterCreditEvent']
type Reset = schemas['MeterResetEvent']

export interface CreditRow {
  credit: Credit
  reversal?: Credit
}

export interface CreditPeriod {
  // null when the period started before the oldest loaded reset
  start: string | null
  // null for the current period
  end: string | null
  total: number
  rows: CreditRow[]
}

// Splits newest-first credit and reset events into billing periods. A
// reversal folds into the credit it reverses when both are loaded.
export const groupCreditsByPeriod = (
  events: (Credit | Reset)[],
): CreditPeriod[] => {
  const loaded = new Set(events.map((event) => event.id))
  const reversals = new Map<string, Credit>()
  for (const event of events) {
    if (event.name === 'meter.credited' && event.metadata.reversed_event_id) {
      reversals.set(event.metadata.reversed_event_id, event)
    }
  }

  const periods: CreditPeriod[] = [
    { start: null, end: null, total: 0, rows: [] },
  ]
  for (const event of events) {
    const period = periods[periods.length - 1]
    if (event.name === 'meter.reset') {
      period.start = event.timestamp
      periods.push({ start: null, end: event.timestamp, total: 0, rows: [] })
      continue
    }
    period.total += event.metadata.units
    const reversedId = event.metadata.reversed_event_id
    if (reversedId && loaded.has(reversedId)) continue
    period.rows.push({ credit: event, reversal: reversals.get(event.id) })
  }
  return periods.filter((period) => period.rows.length > 0)
}
