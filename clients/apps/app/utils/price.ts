import { schemas } from '@polar-sh/client'

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  product: schemas['Product'],
): product is schemas['Product'] & {
  prices: schemas['LegacyRecurringProductPrice'][]
} => product.prices.some(isLegacyRecurringPrice)
