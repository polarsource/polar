import { schemas } from '@polar-sh/client'

export type ImportTaxBehavior = schemas['TaxBehavior']

export const IMPORT_TAX_OPTIONS: {
  value: ImportTaxBehavior
  label: string
}[] = [
  { value: 'inclusive', label: 'Inclusive' },
  { value: 'exclusive', label: 'Exclusive' },
]

export function importTaxBehavior(row: {
  tax_behavior: ImportTaxBehavior | null
}): ImportTaxBehavior {
  return row.tax_behavior ?? 'inclusive'
}

export function importTaxLabel(row: {
  tax_behavior: ImportTaxBehavior | null
}): string {
  return importTaxBehavior(row) === 'exclusive' ? 'Exclusive' : 'Inclusive'
}

export function importTaxHint(behavior: ImportTaxBehavior): string {
  return behavior === 'exclusive'
    ? 'Tax is added on top of the listed price.'
    : 'Customer pays the listed price. Polar takes tax out of it.'
}

export function isImportTaxLocked(row: {
  cutover_status: schemas['MerchantMigrationCutoverStatus'] | null
}): boolean {
  return row.cutover_status === 'moved'
}
