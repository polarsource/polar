import { schemas } from '@polar-sh/client'

export type ImportSummary = schemas['MerchantMigrationImportReport']

export function importResultText(report: ImportSummary): string {
  const byEntity = new Map<schemas['PrecheckEntity'], number>(
    report.results.map((result) => [result.entity, result.imported]),
  )
  const parts = [
    plural(byEntity.get('subscriptions') ?? 0, 'subscription'),
    plural(byEntity.get('products') ?? 0, 'product'),
    plural(byEntity.get('customers') ?? 0, 'customer'),
  ].filter((part) => part !== null)
  if (parts.length === 0) return 'No new records to import.'
  return `Imported ${parts.join(', ')} into Polar.`
}

function plural(count: number, noun: string): string | null {
  if (count === 0) return null
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
