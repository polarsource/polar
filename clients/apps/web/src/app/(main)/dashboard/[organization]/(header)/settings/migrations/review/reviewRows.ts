import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'

export type ReviewRow = schemas['MerchantMigrationRecordItem']
export type ReviewEntity = ReviewRow['entity']

const SINGULAR_LABELS: Record<ReviewEntity, string> = {
  subscriptions: 'Subscription',
  customers: 'Customer',
  products: 'Product',
  prices: 'Price',
}

export function entityLabelSingular(entity: ReviewEntity): string {
  return SINGULAR_LABELS[entity]
}

// The importer ignores records that aren't pending, so every settled ledger
// status is unselectable. Must match the summary's `selectable` count, or the
// ticked rows and the "Import N records" count disagree.
export function isSelectable(row: ReviewRow): boolean {
  return (
    row.record_id != null &&
    row.status === 'importable' &&
    !row.dependencies_imported &&
    row.import_status !== 'imported' &&
    row.import_status !== 'skipped' &&
    row.import_status !== 'failed'
  )
}

export function isImported(row: ReviewRow): boolean {
  return row.import_status === 'imported'
}

// Something the merchant has to fix, as opposed to a note they only read.
export function needsAttention(row: ReviewRow): boolean {
  return row.reason_level === 'action_required' && !isImported(row)
}

const INTERVAL_ABBREVIATION: Record<string, string> = {
  day: '/day',
  week: '/wk',
  month: '/mo',
  year: '/yr',
}

const formatAmount = formatCurrency('accounting', 'en-US')

export interface RowAmount {
  money: string
  interval: string | null
}

// The row's money is a co-primary datum: a formatted amount and, for recurring
// prices, a billing interval abbreviation kept separate so the amounts can align
// their decimals down the column. Rows without a price (customers) return null.
export function rowAmount(row: ReviewRow): RowAmount | null {
  if (row.amount == null || !row.currency) return null
  const money = formatAmount(row.amount, row.currency)
  const interval = row.recurring_interval
    ? (INTERVAL_ABBREVIATION[row.recurring_interval] ?? null)
    : null
  return { money, interval }
}

const RELATIVE = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Near renewals read relatively; further out, as a calendar day. */
export function renewsLabel(
  row: ReviewRow,
  now: number = Date.now(),
): string | null {
  if (!row.renews_at) return null
  const renews = new Date(row.renews_at).getTime()
  if (Number.isNaN(renews)) return null
  const delta = renews - now
  const days = Math.round(delta / DAY)
  if (Math.abs(days) < 30) {
    if (Math.abs(delta) < DAY) {
      return RELATIVE.format(Math.round(delta / HOUR), 'hour')
    }
    return RELATIVE.format(days, 'day')
  }
  return `on ${MONTH_DAY.format(new Date(row.renews_at))}`
}
