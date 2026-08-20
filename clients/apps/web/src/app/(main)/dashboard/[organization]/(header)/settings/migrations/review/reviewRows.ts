import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { ENTITY_LABELS } from '../reasons'

export type ReviewRow = schemas['MerchantMigrationRecordItem']
export type ReviewEntity = ReviewRow['entity']
// The table can scope to one listable entity or show them all together. Prices
// aren't listed as their own rows, so they're excluded from the scope.
export type ReviewScope = 'all' | 'products' | 'customers' | 'subscriptions'

const SINGULAR_LABELS: Record<ReviewEntity, string> = {
  subscriptions: 'Subscription',
  customers: 'Customer',
  products: 'Product',
  prices: 'Price',
}

export function entityLabelPlural(entity: ReviewScope): string {
  return entity === 'all' ? 'All' : ENTITY_LABELS[entity]
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
