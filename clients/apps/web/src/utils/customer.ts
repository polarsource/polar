import { Client, schemas, unwrap } from '@spaire/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCustomerById = async (
  api: Client,
  id: string,
): Promise<schemas['Customer']> => {
  return unwrap(
    api.GET('/v1/customers/{id}', {
      params: {
        path: { id },
      },
      cache: 'no-store',
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getCustomerById = cache(_getCustomerById)
