import { Client, components, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

export const hasIntervals = (
  product:
    | components['schemas']['ProductStorefront']
    | components['schemas']['CheckoutProduct'],
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

const _getProductById = async (
  api: Client,
  id: string,
): Promise<components['schemas']['Product']> => {
  return unwrap(
    api.GET('/v1/products/{id}', {
      params: {
        path: {
          id,
        },
      },
      cache: 'no-store',
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getProductById = cache(_getProductById)
