import { schemas } from '@polar-sh/client'

// Formatting shared by the review and switch detail panels, which describe the
// same ledger record from different steps.
type MigrationRecord = schemas['MerchantMigrationRecordItem']

const FULL_DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/** The renewal as a calendar date. The panels state the day itself; only the
 * tables' narrow columns trade it for a relative reading. */
export function renewalDate(row: MigrationRecord): string | null {
  if (!row.renews_at) return null
  const renews = new Date(row.renews_at)
  if (Number.isNaN(renews.getTime())) return null
  return FULL_DATE.format(renews)
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
