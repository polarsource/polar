import { schemas } from '@polar-sh/client'
import { formatDate } from '@polar-sh/i18n/formatters/date'

type MigrationRecord = schemas['MerchantMigrationRecordItem']

const RELATIVE = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export function renewalDate(row: MigrationRecord): string | null {
  if (!row.renews_at) return null
  const renews = new Date(row.renews_at)
  if (Number.isNaN(renews.getTime())) return null
  return formatDate(renews)
}

export function renewsLabel(
  row: MigrationRecord,
  {
    now = Date.now(),
    calendarAfterDays = 30,
  }: { now?: number; calendarAfterDays?: number | null } = {},
): string | null {
  if (!row.renews_at) return null
  const renews = new Date(row.renews_at).getTime()
  if (Number.isNaN(renews)) return null
  const delta = renews - now
  const days = Math.round(delta / DAY)
  if (calendarAfterDays != null && Math.abs(days) >= calendarAfterDays) {
    return `on ${MONTH_DAY.format(new Date(row.renews_at))}`
  }
  if (Math.abs(delta) < DAY) {
    return RELATIVE.format(Math.round(delta / HOUR), 'hour')
  }
  return RELATIVE.format(days, 'day')
}

export function intervalLabel(row: MigrationRecord): string | null {
  const interval = row.recurring_interval
  if (!interval) return null
  const count = row.recurring_interval_count ?? 1
  return count === 1 ? `Every ${interval}` : `Every ${count} ${interval}s`
}

export function taxLabel(row: MigrationRecord): string | null {
  if (row.automatic_tax == null) return null
  return row.automatic_tax ? 'Calculated by Stripe' : 'Not calculated by Stripe'
}
