import { Client, schemas, unwrap } from '@polar-sh/client'
import type { StatusColor } from '@polar-sh/orbit'
import { notFound } from 'next/navigation'
import { cache } from 'react'

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
  StatusColor
> = {
  open: 'blue',
  confirmed: 'yellow',
  succeeded: 'green',
  expired: 'gray',
  failed: 'red',
}
