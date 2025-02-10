import {
  getRecurringBillingLabel,
  getRecurringProductPrice,
} from '@/components/Subscriptions/utils'
import { components } from '@polar-sh/client'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import { useProducts } from './queries'

export const useRecurringInterval = (
  products: components['schemas']['ProductStorefront'][],
): [
  components['schemas']['SubscriptionRecurringInterval'],
  Dispatch<
    SetStateAction<components['schemas']['SubscriptionRecurringInterval']>
  >,
  boolean,
] => {
  const hasMonthInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' && price.recurring_interval === 'month',
      ),
    )
  }, [products])
  const hasYearInterval = useMemo(() => {
    return products.some((product) =>
      product.prices.some(
        (price) =>
          price.type === 'recurring' && price.recurring_interval === 'year',
      ),
    )
  }, [products])
  const hasBothIntervals = useMemo(
    () => hasMonthInterval && hasYearInterval,
    [hasMonthInterval, hasYearInterval],
  )

  const [recurringInterval, setRecurringInterval] = useState<
    components['schemas']['SubscriptionRecurringInterval']
  >(hasBothIntervals ? 'month' : hasYearInterval ? 'year' : 'month')

  return [recurringInterval, setRecurringInterval, hasBothIntervals]
}

export const useRecurringProductPrice = (
  product: Partial<components['schemas']['ProductStorefront']>,
  recurringInterval: components['schemas']['SubscriptionRecurringInterval'],
): components['schemas']['ProductPriceRecurring'] | undefined => {
  return useMemo(
    () => getRecurringProductPrice(product, recurringInterval),
    [product, recurringInterval],
  )
}

export const useRecurringBillingLabel = (
  recurringInterval:
    | components['schemas']['SubscriptionRecurringInterval']
    | null,
) => {
  return useMemo(
    () =>
      recurringInterval ? getRecurringBillingLabel(recurringInterval) : '',
    [recurringInterval],
  )
}

export const useProductsByPriceType = (
  organizationId: string,
): Record<
  components['schemas']['ProductPriceType'],
  components['schemas']['Product'][]
> => {
  const { data: products } = useProducts(organizationId, { limit: 100 })
  return useMemo(
    () => ({
      one_time:
        products?.items.filter((product) =>
          product.prices.some((price) => price.type === 'one_time'),
        ) || [],
      recurring:
        products?.items.filter((product) =>
          product.prices.some((price) => price.type === 'recurring'),
        ) || [],
    }),
    [products],
  )
}
