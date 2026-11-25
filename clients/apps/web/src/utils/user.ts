import { schemas } from '@polar-sh/client'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getServerSideAPI } from './client/serverside'
import { CONFIG } from './config'

const _getAuthenticatedUser = async (): Promise<
  schemas['UserRead'] | undefined
> => {
  if (!(await cookies()).has(CONFIG.AUTH_COOKIE_KEY)) {
    return undefined
  }

  const api = await getServerSideAPI()
  const { data, response } = await api.GET('/v1/users/me', {
    cache: 'no-store',
  })

  // A 429 means resolving the session was rate-limited upstream (the session
  // cookie is being counted in the API's `pending_auth` bucket). We can't
  // determine the user, so we proceed as anonymous rather than turning a
  // transient rate-limit into a hard 500 for the user.
  if (response.status === 429) {
    console.error(
      `Rate limited while fetching authenticated user: status=429, headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`,
    )
  } else if (!response.ok && response.status !== 401) {
    console.error(
      `Error response: status=${response.status}, headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`,
    )
    throw new Error(
      'Unexpected response status while fetching authenticated user',
    )
  }

  return data
}

export const getAuthenticatedUser = cache(_getAuthenticatedUser)

// The proxy only checks that a session cookie exists; this catches one the
// API no longer accepts.
export const requireAuthenticatedUser = async (): Promise<
  schemas['UserRead']
> => {
  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/auth')
  }
  return user
}

export const getUserOrganizations = async (): Promise<
  schemas['OrganizationWithRole'][]
> => {
  const user = await getAuthenticatedUser()
  return user?.organizations ?? []
}
