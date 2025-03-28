import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'

export const hasRecurringIntervals = (
  product: CheckoutProduct,
): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurringInterval === 'month',
  )
  const hasYearInterval = product.prices.some(
    (price) => price.type === 'recurring' && price.recurringInterval === 'year',
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [hasMonthInterval, hasYearInterval, hasBothIntervals]
}

export const isLegacyRecurringPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is LegacyRecurringProductPrice => 'legacy' in price

export const hasLegacyRecurringPrices = (
  product: CheckoutProduct,
): product is CheckoutProduct & {
  prices: LegacyRecurringProductPrice[]
} => product.prices.some(isLegacyRecurringPrice)

export const isMeteredPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is ProductPriceMeteredUnit => price.amountType === 'metered_unit'

export const getMeteredPrices = (
  product: CheckoutProduct,
): ProductPriceMeteredUnit[] => product.prices.filter(isMeteredPrice)
