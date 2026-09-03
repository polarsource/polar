import { polarClient } from '@polar-sh/better-auth'
import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001', // the base url of your auth server
  plugins: [organizationClient(), polarClient()],
})

export const checkoutForOrganization = (organizationId: string) =>
  authClient.checkout({
    slug: 'pro',
    organizationId,
  })

export const openOrganizationPortal = (organizationId: string) =>
  authClient.customer.portal({
    query: { organizationId },
  })

export const { signIn, signUp, useSession } = authClient
