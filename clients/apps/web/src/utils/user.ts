import { PolarAPI, ResponseError, UserRead } from '@polar-sh/sdk'
import { cache } from 'react'

export const _getAuthenticatedUser = async (
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
