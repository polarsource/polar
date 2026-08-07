import { CountEntity } from '@/hooks/queries/merchantMigrations'

export type ImportedCounts = Record<CountEntity, number>

export function importedTotal(counts: ImportedCounts): number {
  return counts.subscriptions + counts.products + counts.customers
}

// "1 subscription, 3 products and 13 customers". Entity types that landed
// nothing are dropped rather than reported as zero; callers check
// `importedTotal` first, so an all-zero count has no wording of its own.
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
