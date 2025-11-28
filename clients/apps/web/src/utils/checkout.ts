import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCheckoutByClientSecret = async (
  api: Client,
  clientSecret: string,
): Promise<schemas['CheckoutPublic']> => {
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

const _getCheckoutById = async (
  api: Client,
  id: string,
): Promise<schemas['Checkout']> => {
  return unwrap(
    api.GET('/v1/checkouts/{id}', {
      params: {
        path: {
          id,
        },
      },
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getCheckoutById = cache(_getCheckoutById)

export const CheckoutStatusDisplayTitle: Record<
  schemas['CheckoutStatus'],
  string
> = {
  open: 'Open',
  confirmed: 'Confirmed',
  succeeded: 'Succeeded',
  expired: 'Expired',
  failed: 'Failed',
}

export const CheckoutStatusDisplayColor: Record<
  schemas['CheckoutStatus'],
  string
> = {
  open: 'bg-blue-100 text-blue-500 dark:bg-blue-950',
  confirmed: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  succeeded: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  expired: 'bg-gray-100 text-gray-500 dark:bg-polar-800 dark:text-polar-500',
  failed: 'bg-red-100 text-red-500 dark:bg-red-950',
}
