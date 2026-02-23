import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit'

export const isLegacyRecurringPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is LegacyRecurringProductPrice => 'legacy' in price

export const hasLegacyRecurringPrices = (
  prices: ProductPrice[],
): prices is LegacyRecurringProductPrice[] =>
  prices.some(isLegacyRecurringPrice)

export const isMeteredPrice = (
  price: ProductPrice | LegacyRecurringProductPrice,
): price is ProductPriceMeteredUnit => price.amountType === 'metered_unit'

export const getMeteredPrices = (
  prices: ProductPrice[],
): ProductPriceMeteredUnit[] => prices.filter(isMeteredPrice)
