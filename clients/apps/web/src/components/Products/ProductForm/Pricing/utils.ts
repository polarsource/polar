import { schemas } from '@polar-sh/client'
import { ProductFormType } from '../ProductForm'

export type ProductPrice = schemas['ProductPrice']
export type ProductPriceCreate = schemas['ProductCreate']['prices'][number]
export type AnyPrice = NonNullable<ProductFormType['prices']>[number]
export type PriceEntry = { price: AnyPrice; index: number }

/**
 * The options shown in the per-price "Price Type" selector. `set_on_order` is a
 * virtual option (not a real `amount_type`): it maps to a custom price with
 * `merchant_priced` set, i.e. the merchant decides the amount at order-creation
 * time for off-session charges.
 */
export type PriceTypeOption = ProductPriceCreate['amount_type'] | 'set_on_order'

export const hasPriceCurrency = (
  price: AnyPrice,
): price is AnyPrice & { price_currency: string } => {
  return 'price_currency' in price && typeof price.price_currency === 'string'
}

export const groupPricesByCurrency = (
  prices: ProductFormType['prices'],
): Map<string, PriceEntry[]> => {
  const grouped = new Map<string, PriceEntry[]>()
  if (!prices) return grouped
  for (let index = 0; index < prices.length; index++) {
    const price = prices[index]
    if (hasPriceCurrency(price)) {
      const currency = price.price_currency || 'usd'
      if (!grouped.has(currency)) {
        grouped.set(currency, [])
      }
      grouped.get(currency)!.push({ price, index })
    }
  }
  return grouped
}

export const getActiveCurrencies = (
  prices: ProductFormType['prices'],
): string[] => {
  const currencies = new Set<string>()
  if (!prices) return []
  for (const price of prices) {
    if (hasPriceCurrency(price)) {
      currencies.add(price.price_currency || 'usd')
    }
  }
  return Array.from(currencies)
}
