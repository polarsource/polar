import { Customer, PolarAPI, ResponseError } from '@polar-sh/api'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCustomerById = async (
  api: PolarAPI,
  id: string,
): Promise<Customer> => {
  try {
    return await api.customers.get(
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
export const getCustomerById = cache(_getCustomerById)
