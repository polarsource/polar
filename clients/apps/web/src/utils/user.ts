import { Client, schemas } from '@polar-sh/client'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { cache } from 'react'

async function retryWithBackoff<T>(
  fn: () => Promise<{ data?: T; error?: any }>,
  maxRetries = 3,
): Promise<{ data?: T; error?: any }> {
  let delay = 100
  let lastResult

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastResult = await fn()

      if (!lastResult.error) {
        return lastResult
      }
    } catch (error) {
      lastResult = { error }
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, 1000)
    }
  }

  return lastResult!
}

const _getAuthenticatedUser = async (): Promise<
  schemas['UserRead'] | undefined
> => {
  // Middleware set this header for authenticated requests
  const userData = (await headers()).get('x-polar-user')
  if (userData) {
    return JSON.parse(userData)
  }
  return undefined
}

// ...but tell React to memoize it for the duration of the request
export const getAuthenticatedUser = cache(_getAuthenticatedUser)

const _getUserOrganizations = async (
  api: Client,
  bypassCache: boolean = false,
): Promise<schemas['Organization'][]> => {
  const user = await getAuthenticatedUser()
  if (!user) {
    return []
  }

  const requestOptions: any = {
    params: {
      query: {
        limit: 100,
        sorting: ['name'],
      },
    },
  }

  if (bypassCache) {
    requestOptions.cache = 'no-cache'
  } else {
    requestOptions.next = {
      tags: [`users:${user.id}:organizations`],
      revalidate: 600,
    }
  }

  const { data, error } = await retryWithBackoff(() =>
    api.GET('/v1/organizations/', requestOptions),
  )

  if (error) {
    console.error('getUserOrganizations failed after retries:', user.id, error)
    Sentry.captureException(
      new Error('Failed to fetch organizations after retries'),
      {
        user: { id: user.id, email: user.email },
        extra: { originalError: error },
      },
    )
    return []
  }

  return data.items
}

// Create a cached version that doesn't bypass cache by default
const _getUserOrganizationsCached = (api: Client) =>
  _getUserOrganizations(api, false)

// ...but tell React to memoize it for the duration of the request
export const getUserOrganizations = (
  api: Client,
  bypassCache: boolean = false,
) => {
  if (bypassCache) {
    return _getUserOrganizations(api, true)
  }
  return cache(_getUserOrganizationsCached)(api)
}
