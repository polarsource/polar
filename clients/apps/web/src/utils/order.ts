import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrderById = async (
  api: Client,
  id: string,
): Promise<schemas['Order']> => {
  return unwrap(
    api.GET('/v1/orders/{id}', {
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
export const getOrderById = cache(_getOrderById)

/**
 * Determines if an order is eligible for payment retry
 */
export const canRetryOrderPayment = (
  order: schemas['CustomerOrder'],
): boolean => {
  return (
    order.status === 'pending' &&
    order.next_payment_attempt_at !== null &&
    order.subscription !== null
  )
}
