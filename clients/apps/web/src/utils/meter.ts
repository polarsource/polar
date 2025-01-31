import { Meter, PolarAPI, ResponseError } from '@polar-sh/api'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getMeterById = async (api: PolarAPI, id: string): Promise<Meter> => {
  try {
    return await api.meters.get(
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
export const getMeterById = cache(_getMeterById)
