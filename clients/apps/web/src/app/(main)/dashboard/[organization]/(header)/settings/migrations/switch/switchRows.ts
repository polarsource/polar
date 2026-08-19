import { schemas } from '@polar-sh/client'

export type SwitchRow = schemas['MerchantMigrationRecordItem']
export type SwitchCutoverStatus = schemas['MerchantMigrationCutoverStatus']

export function isSwitched(row: SwitchRow): boolean {
  return row.cutover_status === 'moved'
}

// Imported and not yet billed by Polar, so it can be picked. Skipped and failed
// rows re-open on a retry, so they stay selectable too; only the moved ones and
// anything not imported are out.
export function isSwitchable(row: SwitchRow): boolean {
  return (
    row.record_id != null &&
    row.import_status === 'imported' &&
    row.cutover_status !== 'moved'
  )
}

// Left on the source with a reason the merchant can act on.
export function needsAttention(row: SwitchRow): boolean {
  return row.cutover_status === 'skipped' || row.cutover_status === 'failed'
}

const RELATIVE = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// When the source next renews, phrased relative to now. The switch keeps a 24h
// safety window, so hours matter near the edge; days are enough further out.
export function renewsLabel(row: SwitchRow, now: number = Date.now()): string | null {
  if (!row.renews_at) return null
  const delta = new Date(row.renews_at).getTime() - now
  if (Number.isNaN(delta)) return null
  const absolute = Math.abs(delta)
  if (absolute >= DAY) {
    return RELATIVE.format(Math.round(delta / DAY), 'day')
  }
  return RELATIVE.format(Math.round(delta / HOUR), 'hour')
}

const INTERVAL_ABBREVIATION: Record<string, string> = {
  day: '/day',
  week: '/wk',
  month: '/mo',
  year: '/yr',
}

export function intervalAbbreviation(interval: string | null): string | null {
  if (!interval) return null
  return INTERVAL_ABBREVIATION[interval] ?? null
}
