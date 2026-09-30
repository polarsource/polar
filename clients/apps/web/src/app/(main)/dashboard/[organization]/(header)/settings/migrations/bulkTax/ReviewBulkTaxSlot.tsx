'use client'

import { DataTableColumnDef } from '@polar-sh/orbit'
import { ReviewRow } from '../review/reviewRows'
import { BulkTaxBanner } from './BulkTaxBanner'
import { BulkTaxSummaryCard } from './BulkTaxSummaryCard'
import { BulkTaxToolbarButton } from './BulkTaxToolbarButton'
import { BulkTaxVariant } from './bulkTaxVariant'
import { buildTaxColumn } from './TaxColumn'

export { useBulkTaxVariant } from './bulkTaxVariant'

export function reviewTaxColumns(
  variant: BulkTaxVariant | null,
  migrationId: string,
): DataTableColumnDef<ReviewRow>[] {
  return variant === 1 ? [buildTaxColumn<ReviewRow>(migrationId, true)] : []
}

export function ReviewBulkTaxSlot({
  variant,
  placement,
  migrationId,
  disabled = false,
}: {
  variant: BulkTaxVariant | null
  placement: 'toolbar' | 'above-table'
  migrationId: string
  disabled?: boolean
}) {
  if (placement === 'toolbar') {
    return variant === 2 ? (
      <BulkTaxToolbarButton migrationId={migrationId} disabled={disabled} />
    ) : null
  }
  if (variant === 3) {
    return <BulkTaxBanner migrationId={migrationId} />
  }
  if (variant === 5) {
    return <BulkTaxSummaryCard migrationId={migrationId} />
  }
  return null
}
