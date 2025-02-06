import { Client, components } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getCustomerById = async (
  api: Client,
  id: string,
): Promise<components['schemas']['Customer']> => {
  const { data, error, response } = await api.GET('/v1/customers/{id}', {
    params: {
      path: { id },
    },
    cache: 'no-store',
  })

  if (error) {
    if (response.status === 404) {
      notFound()
    }
    throw error
  }

  return data
}

// Tell React to memoize it for the duration of the request
export const getCustomerById = cache(_getCustomerById)
