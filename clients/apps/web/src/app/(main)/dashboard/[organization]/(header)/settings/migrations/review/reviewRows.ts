import { schemas } from '@polar-sh/client'

export type ReviewRow = schemas['MerchantMigrationRecordItem']
export type ReviewEntity = ReviewRow['entity']

// Records are grouped into these sections, in this order — subscriptions first
// because they're the point of the migration, then the catalog they depend on.
export const ENTITY_ORDER: ReviewEntity[] = [
  'subscriptions',
  'products',
  'customers',
]

export function entityLabelPlural(entity: ReviewEntity): string {
  switch (entity) {
    case 'subscriptions':
      return 'Subscriptions'
    case 'customers':
      return 'Customers'
    default:
      return 'Products'
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

// Importable, not yet imported, and carrying a warning the merchant should read.
export function needsAttention(row: ReviewRow): boolean {
  return row.status === 'importable' && !isImported(row) && Boolean(row.reason)
}

export function selectableIds(rows: ReviewRow[]): string[] {
  return rows
    .filter(isSelectable)
    .map((row) => row.record_id)
    .filter((id): id is string => id != null)
}

export interface ReviewGroupData {
  entity: ReviewEntity
  rows: ReviewRow[]
}

export function groupRows(rows: ReviewRow[]): ReviewGroupData[] {
  return ENTITY_ORDER.map((entity) => ({
    entity,
    rows: rows.filter((row) => row.entity === entity),
  })).filter((group) => group.rows.length > 0)
}

// The single-word status shown per row. Colour is neutral except the one
// signal that wants the merchant's eye: a row flagged for review.
export function rowStatus(row: ReviewRow): {
  label: string
  color: 'gray' | 'yellow'
} {
  if (needsAttention(row)) return { label: 'Review', color: 'yellow' }
  if (isImported(row)) return { label: 'Imported', color: 'gray' }
  if (row.status === 'skipped') return { label: 'Skipped', color: 'gray' }
  return { label: 'Ready', color: 'gray' }
}
