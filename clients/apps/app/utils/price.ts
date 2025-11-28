import { schemas } from '@polar-sh/client'

export const hasIntervals = (
  product: schemas['Product'],
): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'month',
  )
  const hasYearInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'year',
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [hasMonthInterval, hasYearInterval, hasBothIntervals]
}

type ProductPrice =
  | schemas['ProductPriceFixed']
  | schemas['ProductPriceCustom']
  | schemas['ProductPriceFree']
  | schemas['ProductPriceMeteredUnit']

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  product: schemas['Product'],
): product is schemas['Product'] & {
  prices: schemas['LegacyRecurringProductPrice'][]
} => product.prices.some(isLegacyRecurringPrice)

export const isStaticPrice = (
  price: ProductPrice,
): price is
  | schemas['ProductPriceFixed']
  | schemas['ProductPriceCustom']
  | schemas['ProductPriceFree'] =>
  price.amount_type !== undefined &&
  ['fixed', 'custom', 'free'].includes(price.amount_type)

export const isMeteredPrice = (
  price: ProductPrice,
): price is schemas['ProductPriceMeteredUnit'] =>
  price.amount_type === 'metered_unit'
