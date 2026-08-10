import { CountEntity } from '@/hooks/queries/merchantMigrationCounts'

export type ImportedCounts = Record<CountEntity, number>

export function importedTotal(counts: ImportedCounts): number {
  return counts.subscriptions + counts.products + counts.customers
}

// True only on a settled read. `isFetching` matters as much as `isLoading`:
// the refetch the import itself triggers serves the pre-import zeros until it
// lands, which would read as "nothing imported" just as the import succeeded.
export function nothingImported(outcome: {
  imported: ImportedCounts
  isLoading: boolean
  isFetching: boolean
  isError: boolean
}): boolean {
  return (
    !outcome.isLoading &&
    !outcome.isFetching &&
    !outcome.isError &&
    importedTotal(outcome.imported) === 0
  )
}

// "1 subscription, 3 products and 13 customers", dropping what landed nothing.
export function importedCountsText(counts: ImportedCounts): string {
  const parts = [
    plural(counts.subscriptions, 'subscription'),
    plural(counts.products, 'product'),
    plural(counts.customers, 'customer'),
  ].filter((part) => part !== null)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function plural(count: number, noun: string): string | null {
  if (count === 0) return null
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
