import { MAPPING_KINDS, MappingKind, MappingRow } from './idMapping'

export function matchesQuery(row: MappingRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [row.stripeId, row.polarId, row.label, row.detail].some((value) =>
    value?.toLowerCase().includes(needle),
  )
}

const STRIPE_PREFIXES: [string, MappingKind][] = [
  ['cus_', 'customers'],
  ['prod_', 'products'],
  ['price_', 'prices'],
  ['sub_', 'subscriptions'],
]

// Coupon IDs are merchant-chosen, so anything without a known prefix is
// looked up across every kind.
export function kindForStripeId(stripeId: string): MappingKind | null {
  const match = STRIPE_PREFIXES.find(([prefix]) => stripeId.startsWith(prefix))
  return match ? match[1] : null
}

const MAX_LOOKUPS = 20

export function lookupStripeIds(
  mapping: Record<MappingKind, MappingRow[]>,
  input: string,
): { stripeId: string; rows: MappingRow[] }[] {
  const ids = [...new Set(input.split(/[\s,]+/).filter(Boolean))]
  return ids.slice(0, MAX_LOOKUPS).map((stripeId) => {
    const kind = kindForStripeId(stripeId)
    const kinds = kind ? [kind] : MAPPING_KINDS
    return {
      stripeId,
      rows: kinds.flatMap((candidate) =>
        mapping[candidate].filter((row) => row.stripeId === stripeId),
      ),
    }
  })
}
