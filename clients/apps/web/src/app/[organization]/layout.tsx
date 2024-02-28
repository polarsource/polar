import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { getServerSideAPI } from '@/utils/api'
import {
  ListResourceSubscriptionSummary,
  Organization,
  Platforms,
  UserRead,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
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

  try {
    const [loadAuthenticatedUser, loadOrganization, loadSubscriptionsSummary] =
      await Promise.all([
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
            limit: 9,
          },
          cacheConfig,
        ),
      ])

    authenticatedUser = loadAuthenticatedUser
    organization = loadOrganization
    subscriptionsSummary = loadSubscriptionsSummary
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <div className="flex flex-col">
      <div className="relative mx-auto flex w-full max-w-[1580px] shrink-0 flex-col items-start px-2 md:h-full md:flex-row md:gap-32 md:space-y-8 md:px-24">
        <div className="relative flex w-full max-w-xs flex-col justify-between py-16 md:sticky md:top-0">
          <OrganizationPublicSidebar
            subscriptionsSummary={subscriptionsSummary}
            organization={organization}
          />
        </div>
        <div className="flex h-full w-full flex-col py-12 md:gap-y-16">
          <div className="flex flex-row items-center justify-between">
            <OrganizationPublicPageNav organization={organization} />
            <PolarMenu authenticatedUser={authenticatedUser} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
