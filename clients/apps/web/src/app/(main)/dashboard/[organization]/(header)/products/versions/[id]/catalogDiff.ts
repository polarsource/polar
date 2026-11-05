import { schemas } from '@polar-sh/client'

type Benefit = schemas['Benefit']
type CatalogProduct = schemas['CatalogProduct']
type Product = schemas['Product']

export const changes = ['added', 'changed', 'removed'] as const

export type Change = (typeof changes)[number]

export type Entry = {
  row: CatalogProduct
  change: Change | null
  previousProductId?: string
}

export const diffCatalog = (
  rows: CatalogProduct[],
  parentRows: CatalogProduct[] | undefined,
): Entry[] => {
  if (!parentRows) return rows.map((row) => ({ row, change: null }))

  const parentByKey = new Map(parentRows.map((row) => [row.external_id, row]))
  const keys = new Set(rows.map((row) => row.external_id))

  return [
    ...rows.map((row): Entry => {
      const previous = parentByKey.get(row.external_id)
      if (!previous) return { row, change: 'added' }
      if (previous.product_id === row.product_id) return { row, change: null }
      return { row, change: 'changed', previousProductId: previous.product_id }
    }),
    ...parentRows
      .filter((row) => !keys.has(row.external_id))
      .map((row): Entry => ({ row, change: 'removed' })),
  ].sort((a, b) => a.row.external_id.localeCompare(b.row.external_id))
}

// Fields that differ between copies of the same price across product versions
const identityFields = new Set([
  'id',
  'created_at',
  'modified_at',
  'product_id',
])

export const priceSignature = ({
  prices,
  recurring_interval,
  recurring_interval_count,
}: Product) =>
  JSON.stringify(
    [recurring_interval, recurring_interval_count, prices],
    (key, value) => (identityFields.has(key) ? undefined : value),
  )

export type BenefitChange =
  | { type: 'added'; after: Benefit }
  | { type: 'removed'; before: Benefit }
  | { type: 'updated'; before: Benefit; after: Benefit }

const benefitKey = (benefit: Benefit) => benefit.external_id ?? benefit.id

// A benefit with the same key but a different ID is a new version of that benefit
export const diffBenefits = (
  before: Benefit[],
  after: Benefit[],
): BenefitChange[] => {
  const beforeByKey = new Map(
    before.map((benefit) => [benefitKey(benefit), benefit]),
  )
  const afterKeys = new Set(after.map(benefitKey))

  return [
    ...after.flatMap((benefit): BenefitChange[] => {
      const previous = beforeByKey.get(benefitKey(benefit))
      if (!previous) return [{ type: 'added', after: benefit }]
      if (previous.id === benefit.id) return []
      return [{ type: 'updated', before: previous, after: benefit }]
    }),
    ...before
      .filter((benefit) => !afterKeys.has(benefitKey(benefit)))
      .map((benefit): BenefitChange => ({ type: 'removed', before: benefit })),
  ]
}
