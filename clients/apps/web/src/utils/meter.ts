import { Client, schemas, unwrap } from '@spaire/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getMeterById = async (
  api: Client,
  id: string,
): Promise<schemas['Meter']> => {
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
