import { CheckoutPublic, PolarAPI, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCheckoutByClientSecret = async (
  api: PolarAPI,
  clientSecret: string,
): Promise<CheckoutPublic> => {
  try {
    return await api.checkouts.clientGet(
      {
        clientSecret,
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
export const getCheckoutByClientSecret = cache(_getCheckoutByClientSecret)
