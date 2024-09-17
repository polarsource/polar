import {
  getRecurringBillingLabel,
  getRecurringProductPrice,
  getSubscriptionTierAudience,
} from '@/components/Subscriptions/utils'
import {
  Product,
  ProductPriceRecurring,
  ProductPriceType,
  SubscriptionRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import { useProducts } from './queries'

export const useRecurringInterval = (
  products: Product[],
): [
  SubscriptionRecurringInterval,
  Dispatch<SetStateAction<SubscriptionRecurringInterval>>,
  boolean,
] => {
  const hasMonthInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.MONTH,
      ),
    )
  }, [products])
  const hasYearInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.YEAR,
      ),
    )
  }, [products])
  const hasBothIntervals = useMemo(
    () => hasMonthInterval && hasYearInterval,
    [hasMonthInterval, hasYearInterval],
  )

  const [recurringInterval, setRecurringInterval] =
    useState<SubscriptionRecurringInterval>(
      hasBothIntervals
        ? SubscriptionRecurringInterval.MONTH
        : hasYearInterval
          ? SubscriptionRecurringInterval.YEAR
          : SubscriptionRecurringInterval.MONTH,
    )

  return [recurringInterval, setRecurringInterval, hasBothIntervals]
}

export const useRecurringProductPrice = (
  product: Partial<Product>,
  recurringInterval: SubscriptionRecurringInterval,
): ProductPriceRecurring | undefined => {
  return useMemo(
    () => getRecurringProductPrice(product, recurringInterval),
    [product, recurringInterval],
  )
}

export const useRecurringBillingLabel = (
  recurringInterval: SubscriptionRecurringInterval | null,
) => {
  return useMemo(
    () =>
      recurringInterval ? getRecurringBillingLabel(recurringInterval) : '',
    [recurringInterval],
  )
}

export const useProductAudience = (type: SubscriptionTierType) => {
  return useMemo(() => getSubscriptionTierAudience(type), [type])
}

export const useProductsByPriceType = (
  organizationId: string,
): Record<ProductPriceType, Product[]> => {
  const { data: products } = useProducts(organizationId)
  return useMemo(
    () => ({
      [ProductPriceType.ONE_TIME]:
        products?.items.filter((product) =>
          product.prices.some(
            (price) => price.type === ProductPriceType.ONE_TIME,
          ),
        ) || [],
      [ProductPriceType.RECURRING]:
        products?.items.filter((product) =>
          product.prices.some(
            (price) => price.type === ProductPriceType.RECURRING,
          ),
        ) || [],
    }),
    [products],
  )
}
