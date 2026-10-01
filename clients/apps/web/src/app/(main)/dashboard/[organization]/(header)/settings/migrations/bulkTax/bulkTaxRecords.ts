import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'

export type TaxBehavior = schemas['TaxBehavior']
export type TaxRow = schemas['MerchantMigrationRecordItem']

const PAGE_LIMIT = 100

export const effectiveTax = (row: TaxRow): TaxBehavior =>
  row.tax_behavior ?? 'inclusive'

// Switched subscriptions are locked server-side (`RecordTaxLocked`), and rows
// staying on Stripe never bill on Polar, so neither is worth a request.
export type EditableTaxRow = TaxRow & { record_id: string }

export const isTaxEditable = (row: TaxRow): row is EditableTaxRow =>
  row.record_id != null &&
  row.cutover_status !== 'moved' &&
  row.status !== 'skipped' &&
  row.import_status !== 'skipped'

// Stripe left the tax unspecified, so the row reads as inclusive but stays
// "Needs info" until the merchant saves a choice, even the same one.
const needsTaxDecision = (row: TaxRow): boolean =>
  row.reason_code === 'subscription_tax_behavior_unspecified'

export const needsTaxUpdate = (row: TaxRow, target: TaxBehavior): boolean =>
  effectiveTax(row) !== target || needsTaxDecision(row)

export interface TaxBreakdown {
  inclusive: number
  exclusive: number
  undecided: number
}

export function taxBreakdown(rows: TaxRow[]): TaxBreakdown {
  const breakdown: TaxBreakdown = {
    inclusive: 0,
    exclusive: 0,
    undecided: 0,
  }
  for (const row of rows) {
    if (isTaxEditable(row)) {
      breakdown[needsTaxDecision(row) ? 'undecided' : effectiveTax(row)] += 1
    }
  }
  return breakdown
}

// The records endpoint has no "not moved" filter and caps a page at 100, so
// the whole subscription list is walked and narrowed client-side.
export async function fetchAllSubscriptionRecords(
  migrationId: string,
): Promise<TaxRow[]> {
  const rows: TaxRow[] = []
  for (let page = 1; ; page++) {
    const result = await unwrap(
      api.GET('/v1/merchant-migrations/{id}/records', {
        params: {
          path: { id: migrationId },
          query: { entity: 'subscriptions', page, limit: PAGE_LIMIT },
        },
      }),
    )
    rows.push(...result.items)
    if (page >= result.pagination.max_page) {
      return rows
    }
  }
}
