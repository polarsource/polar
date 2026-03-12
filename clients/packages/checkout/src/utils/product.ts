import type { schemas } from '@polar-sh/client'

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  prices: schemas['ProductPrice'][],
): prices is schemas['LegacyRecurringProductPrice'][] =>
  prices.some(isLegacyRecurringPrice)

export const isMeteredPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['ProductPriceMeteredUnit'] =>
  price.amount_type === 'metered_unit'

export const getMeteredPrices = (
  prices: schemas['ProductPrice'][],
  currency?: string | null,
): schemas['ProductPriceMeteredUnit'][] =>
  prices.filter(
    (price): price is schemas['ProductPriceMeteredUnit'] =>
      isMeteredPrice(price) && (!currency || price.price_currency === currency),
  )
