import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'

export type ReviewRow = schemas['MerchantMigrationRecordItem']
export type ReviewEntity = ReviewRow['entity']
// The table can scope to one listable entity or show them all together. Prices
// aren't listed as their own rows, so they're excluded from the scope.
export type ReviewScope = 'all' | 'products' | 'customers' | 'subscriptions'

export function entityLabelPlural(entity: ReviewScope): string {
  switch (entity) {
    case 'all':
      return 'All'
    case 'subscriptions':
      return 'Subscriptions'
    case 'customers':
      return 'Customers'
    default:
      return 'Products'
  }
}

export function entityLabelSingular(entity: ReviewEntity): string {
  switch (entity) {
    case 'subscriptions':
      return 'Subscription'
    case 'customers':
      return 'Customer'
    default:
      return 'Product'
  }
}

// A row can be picked for import only when the pre-check says it's importable
// and it isn't already in the ledger as imported.
export function isSelectable(row: ReviewRow): boolean {
  return (
    row.record_id != null &&
    row.status === 'importable' &&
    row.import_status !== 'imported'
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
