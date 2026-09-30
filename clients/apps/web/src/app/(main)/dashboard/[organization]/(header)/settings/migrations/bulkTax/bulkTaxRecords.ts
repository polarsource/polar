import { extractApiErrorMessage } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'

export type TaxBehavior = schemas['TaxBehavior']
export type TaxRow = schemas['MerchantMigrationRecordItem']

const PAGE_LIMIT = 100

export const effectiveTax = (row: TaxRow): TaxBehavior =>
  row.tax_behavior ?? 'inclusive'

// Switched subscriptions are locked server-side (`RecordTaxLocked`), and rows
// staying on Stripe never bill on Polar, so neither is worth a request.
export const isTaxEditable = (row: TaxRow): boolean =>
  row.record_id != null &&
  row.cutover_status !== 'moved' &&
  row.status !== 'skipped' &&
  row.import_status !== 'skipped'

export interface TaxBreakdown {
  inclusive: number
  exclusive: number
  locked: number
}

export function taxBreakdown(rows: TaxRow[]): TaxBreakdown {
  const breakdown: TaxBreakdown = { inclusive: 0, exclusive: 0, locked: 0 }
  for (const row of rows) {
    if (isTaxEditable(row)) {
      breakdown[effectiveTax(row)] += 1
    } else if (row.cutover_status === 'moved') {
      breakdown.locked += 1
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

export async function patchRecordTax(
  migrationId: string,
  recordId: string,
  taxBehavior: TaxBehavior,
): Promise<void> {
  const result = await api
    .PATCH('/v1/merchant-migrations/{id}/records/{record_id}', {
      params: { path: { id: migrationId, record_id: recordId } },
      body: { tax_behavior: taxBehavior },
    })
    .catch(() => null)
  if (!result || result.error) {
    throw new Error(
      extractApiErrorMessage(
        result?.error ?? {},
        "We couldn't save the tax setting.",
      ),
    )
  }
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, lane),
  )
}
