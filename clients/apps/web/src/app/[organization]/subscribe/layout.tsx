import { getServerSideAPI } from '@/utils/api'
import {
  ListResourceOrganization,
  ListResourceSubscriptionSummary,
  Organization,
  Platforms,
  UserRead,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import React from 'react'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: UserRead | undefined
  let organization: Organization | undefined
  let subscriptionsSummary: ListResourceSubscriptionSummary | undefined
  let userAdminOrganizations: ListResourceOrganization | undefined

  try {
    const [
      loadAuthenticatedUser,
      loadOrganization,
      loadSubscriptionsSummary,
      loadUserAdminOrganizations,
    ] = await Promise.all([
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        // Handle unauthenticated
        return undefined
      }),
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
      api.subscriptions.searchSubscriptionsSummary(
        {
          organizationName: params.organization,
          platform: Platforms.GITHUB,
          limit: 3,
        },
        cacheConfig,
      ),
      // No caching, as we're expecting immediate updates to the response if the user converts to a maintainer
      api.organizations
        .list({ isAdminOnly: true }, { cache: 'no-store' })
        .catch(() => {
          // Handle unauthenticated
          return undefined
        }),
    ])

    authenticatedUser = loadAuthenticatedUser
    organization = loadOrganization
    subscriptionsSummary = loadSubscriptionsSummary
    userAdminOrganizations = loadUserAdminOrganizations
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-[1580px] flex-col items-start px-4 md:h-full md:flex-row md:gap-16 md:space-y-8 md:px-24 lg:gap-32"></div>
    </div>
  )
}
