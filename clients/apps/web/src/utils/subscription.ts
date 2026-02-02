import { Client, schemas, unwrap } from '@spaire/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getSubscriptionById = async (
  api: Client,
  id: string,
): Promise<schemas['Subscription']> => {
  return unwrap(
    api.GET('/v1/subscriptions/{id}', {
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
export const getSubscriptionById = cache(_getSubscriptionById)
