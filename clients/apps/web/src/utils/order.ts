import { Order, PolarAPI, ResponseError } from '@polar-sh/api'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrderById = async (api: PolarAPI, id: string): Promise<Order> => {
  try {
    return await api.orders.get(
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
export const getOrderById = cache(_getOrderById)
