import EmptyLayout from '@/components/Layout/EmptyLayout'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { getServerSideAPI } from '@/utils/api'
import { Organization, Platforms, UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { LogoType } from 'polarkit/components/brand'
import React from 'react'
import LayoutTopbarAuth from './LayoutTopbarAuth'

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
          <div className="dark:bg-polar-900 sticky top-0 z-50 bg-white px-4 py-4 shadow-sm md:px-4">
            <div className="relative mx-auto flex w-full max-w-7xl flex-row items-center justify-between gap-x-24 md:justify-normal md:space-y-0">
              <div className="shrink-0 md:w-64">
                <a href="/">
                  <LogoType />
                </a>
              </div>
              <div className="flex flex-row items-center justify-between md:w-full">
                <div className="hidden md:flex">
                  <OrganizationPublicPageNav organization={organization} />
                </div>

                <LayoutTopbarAuth authenticatedUser={authenticatedUser} />
              </div>
            </div>
          </div>

          <div className="mx-auto mb-16 mt-4 flex w-full max-w-7xl shrink-0 flex-col space-y-8 px-4">
            <div className="flex w-full shrink-0 flex-col gap-8 py-6 md:min-h-screen md:flex-row md:gap-24">
              <OrganizationPublicSidebar organization={organization} />
              <div className="flex w-full flex-row pb-4 md:hidden">
                <OrganizationPublicPageNav
                  className="w-full flex-row"
                  organization={organization}
                  mobileLayout
                />
              </div>
              <div className="flex h-full w-full flex-col gap-y-8">
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
