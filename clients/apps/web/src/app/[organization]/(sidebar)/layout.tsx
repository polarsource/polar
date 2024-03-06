import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { PublicPageOrganizationContextProvider } from '@/providers/organization'
import { getServerSideAPI } from '@/utils/api'
import {
  ListResourceOrganization,
  ListResourceSubscriptionSummary,
  ListResourceSubscriptionTier,
  Organization,
  Platforms,
  UserRead,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { LogoIcon } from 'polarkit/components/brand'
import React from 'react'
import { PolarMenu } from './LayoutPolarMenu'

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
  let subscriptionTiers: ListResourceSubscriptionTier | undefined

  try {
    const [
      loadAuthenticatedUser,
      loadOrganization,
      loadSubscriptionsSummary,
      loadUserAdminOrganizations,
      loadSubscriptionTiers,
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
      api.subscriptions
        .searchSubscriptionTiers(
          {
            platform: Platforms.GITHUB,
            organizationName: params.organization,
          },
          cacheConfig,
        )
        .catch(() => {
          // Handle unauthenticated
          return undefined
        }),
      ,
    ])

    authenticatedUser = loadAuthenticatedUser
    organization = loadOrganization
    subscriptionsSummary = loadSubscriptionsSummary
    userAdminOrganizations = loadUserAdminOrganizations
    subscriptionTiers = loadSubscriptionTiers
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <PublicPageOrganizationContextProvider organization={organization}>
      <div className="flex flex-col">
        <div className="mx-auto flex w-full max-w-[1580px] flex-col items-start px-4 md:h-full md:flex-row md:gap-16 md:space-y-0 md:px-24 lg:gap-32">
          <div className="dark:bg-polar-950 sticky top-0 z-20 flex w-full flex-row items-center justify-between bg-white py-4 md:relative md:hidden">
            <a href="/">
              <LogoIcon
                className="text-blue-500 dark:text-blue-400"
                size={40}
              />
            </a>
            <PolarMenu
              organization={organization}
              authenticatedUser={authenticatedUser}
              userAdminOrganizations={userAdminOrganizations?.items ?? []}
            />
          </div>
          <div className="relative flex w-full flex-col justify-between py-8 md:sticky md:top-0 md:max-w-xs md:py-16">
            <OrganizationPublicSidebar
              subscriptionsSummary={subscriptionsSummary}
              organization={organization}
              userAdminOrganizations={userAdminOrganizations?.items ?? []}
              subscriptionTiers={subscriptionTiers?.items ?? []}
            />
          </div>
          <div className="flex h-full w-full flex-col gap-y-8 md:gap-y-16 md:py-12">
            <div className="flex w-full flex-row flex-wrap items-center justify-between gap-x-8 gap-y-4">
              <div className="flex w-full flex-row items-center gap-x-6 overflow-x-auto md:w-fit md:overflow-x-visible">
                <a className="hidden md:flex" href="/">
                  <LogoIcon
                    className="text-blue-500 dark:text-blue-400"
                    size={40}
                  />
                </a>
                <div className="flex w-full flex-row items-center pb-2 md:pb-0">
                  <OrganizationPublicPageNav organization={organization} />
                </div>
              </div>
              <div className="ml-auto hidden flex-row md:flex">
                <PolarMenu
                  organization={organization}
                  authenticatedUser={authenticatedUser}
                  userAdminOrganizations={userAdminOrganizations?.items ?? []}
                />
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </PublicPageOrganizationContextProvider>
  )
}
