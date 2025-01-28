import { PolarAPI, ResponseError, Subscription } from '@polar-sh/api'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getSubscriptionById = async (
  api: PolarAPI,
  id: string,
): Promise<Subscription> => {
  try {
    return await api.subscriptions.get(
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
export const getSubscriptionById = cache(_getSubscriptionById)
