import { Client, schemas } from '@polar-sh/client'
import { headers } from 'next/headers'
import { cache } from 'react'

const _getAuthenticatedUser = async (): Promise<
  schemas['UserRead'] | undefined
> => {
  // Middleware set this header for authenticated requests
  const userData = headers().get('x-polar-user')
  if (userData) {
    return JSON.parse(userData)
  }
  return undefined
}

// ...but tell React to memoize it for the duration of the request
export const getAuthenticatedUser = cache(_getAuthenticatedUser)

const _getUserOrganizations = async (
  api: Client,
): Promise<schemas['Organization'][]> => {
  const user = await getAuthenticatedUser()
  if (!user) {
    return []
  }

  const { data, error } = await api.GET('/v1/organizations/', {
    params: {
      query: {
        limit: 100,
        sorting: ['name'],
      },
    },
    next: {
      tags: [`users:${user.id}:organizations`],
      revalidate: 600,
    },
  })

  if (error) {
    return []
  }

  return data.items
}

// ...but tell React to memoize it for the duration of the request
export const getUserOrganizations = cache(_getUserOrganizations)
