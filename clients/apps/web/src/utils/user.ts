import { Organization, PolarAPI, ResponseError, UserRead } from '@polar-sh/sdk'
import { cache } from 'react'

const _getAuthenticatedUser = async (
  api: PolarAPI,
): Promise<UserRead | undefined> => {
  try {
    // Don't cache it on Next.js edge cache...
    return await api.users.getAuthenticated({ cache: 'no-cache' })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 401) {
      return undefined
    }
    throw e
  }
}

// ...but tell React to memoize it for the duration of the request
export const getAuthenticatedUser = cache(_getAuthenticatedUser)

const _getUserOrganizations = async (
  api: PolarAPI,
): Promise<Organization[]> => {
  const user = await getAuthenticatedUser(api)
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
