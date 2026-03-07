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
): schemas['ProductPriceMeteredUnit'][] => prices.filter(isMeteredPrice)
