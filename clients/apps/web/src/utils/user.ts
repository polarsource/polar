import { schemas } from '@polar-sh/client'
import { headers } from 'next/headers'
import { cache } from 'react'

const _getAuthenticatedUser = async (): Promise<
  schemas['UserRead'] | undefined
> => {
  // Middleware set this header for authenticated requests
  const userData = (await headers()).get('x-polar-user')
  if (userData) {
    return JSON.parse(Buffer.from(userData, 'base64').toString('utf-8'))
  }
  return undefined
}

// ...but tell React to memoize it for the duration of the request
export const getAuthenticatedUser = cache(_getAuthenticatedUser)

export const getUserOrganizations = async (): Promise<
  schemas['OrganizationWithRole'][]
> => {
  const user = await getAuthenticatedUser()
  return user?.organizations ?? []
}

// Wrap a freshly-created `Organization` as the user's own membership.
// The backend assigns `owner` to the creator (see organization_service.create);
// this just keeps the local auth-context list in sync until the next /me fetch.
export const asOwnedOrganization = (
  organization: schemas['Organization'],
): schemas['OrganizationWithRole'] => ({
  ...organization,
  role: 'owner' as const,
})
