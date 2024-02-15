import EmptyLayout from '@/components/Layout/EmptyLayout'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { getServerSideAPI } from '@/utils/api'
import { Organization, Platforms, UserRead } from '@polar-sh/sdk'
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

  let organization: Organization | undefined
  let authenticatedUser: UserRead | undefined

  try {
    const [loadOrganization, loadAuthenticatedUser] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
      // Handle unauthenticated
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        return undefined
      }),
    ])

    organization = loadOrganization
    authenticatedUser = loadAuthenticatedUser
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <EmptyLayout>
      <div className="flex min-h-screen flex-col justify-between">
        <div className="flex shrink-0 flex-col">
          <div className="mx-auto mt-4 flex w-full max-w-7xl shrink-0 flex-col px-4 md:space-y-8">
            <div className="flex w-full shrink-0 flex-col gap-8 md:min-h-screen md:flex-row md:gap-24">
              <OrganizationPublicSidebar organization={organization} />
              <div className="flex w-full flex-row items-center gap-2 pb-4 md:hidden">
                <OrganizationPublicPageNav
                  className="w-full flex-row"
                  organization={organization}
                  mobileLayout
                />
              </div>
              <div className="flex h-full w-full flex-col md:gap-y-8">
                <OrganizationPublicPageNav
                  className="hidden md:flex"
                  organization={organization}
                />
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </EmptyLayout>
  )
}
