import {
  getRecurringBillingLabel,
  getRecurringProductPrice,
  getSubscriptionTierAudience,
} from '@/components/Subscriptions/utils'
import {
  Product,
  ProductPriceRecurring,
  ProductPriceRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'

export const useRecurringInterval = (
  products: Product[],
): [
  ProductPriceRecurringInterval,
  Dispatch<SetStateAction<ProductPriceRecurringInterval>>,
  boolean,
] => {
  const hasMonthInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === ProductPriceRecurringInterval.MONTH,
      ),
    )
  }, [products])
  const hasYearInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === ProductPriceRecurringInterval.YEAR,
      ),
    )
  }, [products])
  const hasBothIntervals = useMemo(
    () => hasMonthInterval && hasYearInterval,
    [hasMonthInterval, hasYearInterval],
  )

  const [recurringInterval, setRecurringInterval] =
    useState<ProductPriceRecurringInterval>(
      hasBothIntervals
        ? ProductPriceRecurringInterval.MONTH
        : hasYearInterval
          ? ProductPriceRecurringInterval.YEAR
          : ProductPriceRecurringInterval.MONTH,
    )

  return [recurringInterval, setRecurringInterval, hasBothIntervals]
}

export const useRecurringProductPrice = (
  product: Partial<Product>,
  recurringInterval: ProductPriceRecurringInterval,
): ProductPriceRecurring | undefined => {
  return useMemo(
    () => getRecurringProductPrice(product, recurringInterval),
    [product, recurringInterval],
  )
}

export const useRecurringBillingLabel = (
  recurringInterval: ProductPriceRecurringInterval | undefined,
) => {
  return useMemo(
    () =>
      recurringInterval ? getRecurringBillingLabel(recurringInterval) : '',
    [recurringInterval],
  )
}

export const useProductAudience = (type?: SubscriptionTierType) => {
  return useMemo(() => getSubscriptionTierAudience(type), [type])
}
