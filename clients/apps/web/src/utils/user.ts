import { Organization, PolarAPI, ResponseError, UserRead } from '@polar-sh/api'
import { headers } from 'next/headers'
import { cache } from 'react'

const _getAuthenticatedUser = async (): Promise<UserRead | undefined> => {
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
  api: PolarAPI,
): Promise<Organization[]> => {
  const user = await getAuthenticatedUser()
  if (!user) {
    return []
  }

  try {
    const result = await api.organizations.list(
      { limit: 100, sorting: ['name'] },
      {
        next: {
          tags: [`users:${user.id}:organizations`],
          revalidate: 600,
        },
      },
    )
    return result.items || []
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 401) {
      return []
    }
    throw e
  }
}

// ...but tell React to memoize it for the duration of the request
export const getUserOrganizations = cache(_getUserOrganizations)
