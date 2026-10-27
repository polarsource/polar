import { schemas } from '@polar-sh/client'

export type ProductDiff = schemas['CatalogProductDiff']
export type Change = ProductDiff['change']
type Price = schemas['ConfigProductPriceRead']

export interface Summary {
  added: number
  changed: number
  removed: number
  unchanged: number
}

export const summarize = (products: readonly ProductDiff[]): Summary => {
  const summary: Summary = { added: 0, changed: 0, removed: 0, unchanged: 0 }
  for (const product of products) {
    summary[product.change] += 1
  }
  return summary
}

export const versionLabel = (name: string | null, number: number) =>
  name ?? `Version ${number}`

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100)

export const formatPrice = (price: Price): string => {
  switch (price.amount_type) {
    case 'fixed':
      return money(price.price_amount, price.price_currency)
    case 'metered_unit':
      return `${price.unit_amount} ${price.price_currency.toUpperCase()} per ${price.meter} unit`
    default:
      return `${price.amount_type.replace('_', ' ')} in ${price.price_currency.toUpperCase()}`
  }
}

export const formatValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined) return 'none'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none'
    return field === 'prices'
      ? value.map((price) => formatPrice(price as Price)).join(', ')
      : value.map(String).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const fieldLabel = (field: string) => field.replace(/_/g, ' ')
