import { Client, components, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCheckoutByClientSecret = async (
  api: Client,
  clientSecret: string,
): Promise<components['schemas']['CheckoutPublic']> => {
  return unwrap(
    api.GET('/v1/checkouts/client/{client_secret}', {
      params: {
        path: {
          client_secret: clientSecret,
        },
      },
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getCheckoutByClientSecret = cache(_getCheckoutByClientSecret)
