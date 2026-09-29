import { CountEntity } from './recordSummary'

export type ImportedCounts = Record<CountEntity, number>

interface SettledImport {
  imported: ImportedCounts
  readyToSwitch: number
  isLoading: boolean
  isFetching: boolean
  isError: boolean
}

export function importedTotal(counts: ImportedCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0)
}

// True only on a settled read. `isFetching` matters as much as `isLoading`:
// the refetch the import itself triggers serves the pre-import zeros until it
// lands, which would read as "nothing imported" just as the import succeeded.
function settledWithNothingImportedHere(outcome: SettledImport): boolean {
  return (
    !outcome.isLoading &&
    !outcome.isFetching &&
    !outcome.isError &&
    importedTotal(outcome.imported) === 0
  )
}

// Subscriptions an earlier migration prepared count as landed: their customers
// and products were imported there, so this migration's own counts stay zero.
export function nothingImported(outcome: SettledImport): boolean {
  return settledWithNothingImportedHere(outcome) && outcome.readyToSwitch === 0
}

// The subscriptions were prepared by an earlier migration of the account, so
// their cards may be on Polar already and the card move can be skipped.
export function preparedEarlier(outcome: SettledImport): boolean {
  return settledWithNothingImportedHere(outcome) && outcome.readyToSwitch > 0
}

// "1 subscription, 3 products, 2 discounts and 13 customers", dropping what
// landed nothing.
export function importedCountsText(counts: ImportedCounts): string {
  const parts = [
    plural(counts.subscriptions, 'subscription'),
    plural(counts.products, 'product'),
    plural(counts.discounts, 'discount'),
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
