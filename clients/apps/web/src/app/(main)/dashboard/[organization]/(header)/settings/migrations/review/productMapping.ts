import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'

export type ProductMappingItem = schemas['MerchantMigrationProductMappingItem']
export type ProductMappingChoice =
  schemas['MerchantMigrationProductMappingChoice']

export const CREATE_NEW_VALUE = 'create_new'

const formatAmount = formatCurrency('accounting', 'en-US')

const INTERVAL_LABEL: Record<string, [string, string]> = {
  day: ['Daily', 'days'],
  week: ['Weekly', 'weeks'],
  month: ['Monthly', 'months'],
  year: ['Yearly', 'years'],
}

export function mappingSelectValue(item: ProductMappingItem): string {
  if (item.create_new) return CREATE_NEW_VALUE
  if (item.polar_product_id) return item.polar_product_id
  if (item.suggested_product_id) return item.suggested_product_id
  if (!item.requires_choice) return CREATE_NEW_VALUE
  return ''
}

export function visibleMappingItems(
  items: ProductMappingItem[],
): ProductMappingItem[] {
  const hasCatalog = items.some((item) => item.candidates.length > 0)
  if (!hasCatalog) {
    return []
  }
  return items.filter((item) => item.subscriber_count > 0)
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
    (item) =>
      item.requires_choice &&
      item.import_status === 'pending' &&
      item.subscriber_count > 0,
  )
}

export function formatMappingAmount(
  prices: ProductMappingItem['prices'],
): string {
  if (prices.length === 0) {
    return '—'
  }
  return prices
    .map((price) => formatAmount(price.amount, price.currency))
    .join(', ')
}

export function formatMappingInterval(
  interval: string | null,
  count: number,
): string {
  if (!interval) {
    return '—'
  }
  const labels = INTERVAL_LABEL[interval]
  if (!labels) {
    return interval
  }
  const [once, plural] = labels
  return count <= 1 ? once : `Every ${count} ${plural}`
}
