import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'

export type ProductMappingItem = schemas['MerchantMigrationProductMappingItem']
export type ProductMappingChoice =
  schemas['MerchantMigrationProductMappingChoice']

export const CREATE_NEW_VALUE = 'create_new'

const formatAmount = formatCurrency('accounting', 'en-US')

const INTERVAL_ABBREVIATION: Record<string, string> = {
  day: '/day',
  week: '/wk',
  month: '/mo',
  year: '/yr',
}

export function compatibleCandidates(item: ProductMappingItem) {
  return item.candidates.filter((candidate) => candidate.compatible)
}

export function mappingSelectValue(item: ProductMappingItem): string {
  if (item.create_new) return CREATE_NEW_VALUE
  if (item.mapped_product_id) return item.mapped_product_id
  if (item.suggested_product_id) return item.suggested_product_id
  if (!item.requires_choice) return CREATE_NEW_VALUE
  return ''
}

export function shouldShowProductMappingPanel(
  items: ProductMappingItem[],
): boolean {
  return items.some((item) => item.candidates.length > 0)
}

export function mappingChoice(
  sourceId: string,
  value: string,
): ProductMappingChoice {
  return {
    source_id: sourceId,
    polar_product_id: value === CREATE_NEW_VALUE || value === '' ? null : value,
  }
}

export function mappingRequiresChoice(items: ProductMappingItem[]): boolean {
  return items.some(
    (item) => item.requires_choice && item.import_status === 'pending',
  )
}

export function selectedMappingCandidate(item: ProductMappingItem) {
  const value = mappingSelectValue(item)
  if (!value || value === CREATE_NEW_VALUE) return undefined
  return item.candidates.find((candidate) => candidate.id === value)
}

export function grandfatheredPriceWarning(
  item: ProductMappingItem,
): string | null {
  const candidate = selectedMappingCandidate(item)
  if (!candidate?.incompatibilities.includes('amount_mismatch')) {
    return null
  }
  const stripe = formatMappingPrices(item.prices, item.recurring_interval)
  const polar = formatMappingPrices(
    candidate.prices,
    candidate.recurring_interval,
  )
  return `Imported subscribers keep ${stripe}. Polar currently sells this product at ${polar}.`
}

export function formatMappingPrices(
  prices: ProductMappingItem['prices'],
  interval: string | null,
): string {
  const money = prices
    .map((price) => formatAmount(price.amount, price.currency))
    .join(', ')
  const suffix = interval ? (INTERVAL_ABBREVIATION[interval] ?? '') : ''
  return `${money}${suffix}`
}
