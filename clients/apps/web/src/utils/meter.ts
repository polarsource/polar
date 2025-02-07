import { Client, components, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getMeterById = async (
  api: Client,
  id: string,
): Promise<components['schemas']['Meter']> => {
  return unwrap(
    api.GET('/v1/meters/{id}', {
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
export const getMeterById = cache(_getMeterById)
