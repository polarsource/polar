import {
  PolarAPI,
  Product,
  ResponseError,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

export const hasIntervals = (product: Product): [boolean, boolean, boolean] => {
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' &&
      price.recurring_interval === SubscriptionRecurringInterval.MONTH,
  )
  const hasYearInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' &&
      price.recurring_interval === SubscriptionRecurringInterval.YEAR,
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [hasMonthInterval, hasYearInterval, hasBothIntervals]
}

const _getProductById = async (api: PolarAPI, id: string): Promise<Product> => {
  try {
    return await api.products.get(
      {
        id,
      },
      {
        cache: 'no-store',
      },
    )
  } catch (err) {
    if (err instanceof ResponseError && err.response.status === 404) {
      notFound()
    }
    throw err
  }
}

// Tell React to memoize it for the duration of the request
export const getProductById = cache(_getProductById)
