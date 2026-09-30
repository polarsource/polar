import { useSearchParams } from 'next/navigation'

// Temporary: `?bulkTax=1..5` picks which bulk tax control to render while the
// options are compared. Without it, no bulk control shows.
export type BulkTaxVariant = 1 | 2 | 3 | 4 | 5

export function useBulkTaxVariant(): BulkTaxVariant | null {
  const value = Number(useSearchParams().get('bulkTax'))
  return value >= 1 && value <= 5 ? (value as BulkTaxVariant) : null
}
