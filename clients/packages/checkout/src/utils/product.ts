import type { schemas } from '@polar-sh/client'

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  prices: schemas['ProductPrice'][],
): prices is schemas['LegacyRecurringProductPrice'][] =>
  prices.some(isLegacyRecurringPrice)

export type MeteredPrice =
  | schemas['ProductPriceMeteredUnit']
  | schemas['ProductPriceMeteredTiers']

export type MeteredTier =
  schemas['ProductPriceMeteredTiers']['tiers']['tiers'][number]

export const isMeteredPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is MeteredPrice =>
  price.amount_type === 'metered_unit' || price.amount_type === 'metered_tiers'

export const getMeteredPrices = (
  prices: schemas['ProductPrice'][],
  currency?: string | null,
): MeteredPrice[] =>
  prices.filter(
    (price): price is MeteredPrice =>
      isMeteredPrice(price) && (!currency || price.price_currency === currency),
  )

export const getMeteredTiers = (price: MeteredPrice): MeteredTier[] =>
  price.amount_type === 'metered_tiers'
    ? [...price.tiers.tiers].sort(
        (a, b) =>
          Number(a.bound == null) - Number(b.bound == null) ||
          (a.bound ?? 0) - (b.bound ?? 0),
      )
    : []

export const getStartingUnitAmount = (price: MeteredPrice): number =>
  Number.parseFloat(
    price.amount_type === 'metered_tiers'
      ? getMeteredTiers(price)[0].unit_amount
      : price.unit_amount,
  )
