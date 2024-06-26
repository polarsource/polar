import LogoIcon from '@/components/Brand/LogoIcon'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { getServerSideAPI } from '@/utils/api/serverside'
import {
  ListResourceOrganization,
  ListResourceOrganizationCustomer,
  ListResourceProduct,
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
  let organizationCustomers: ListResourceOrganizationCustomer | undefined
  let userAdminOrganizations: ListResourceOrganization | undefined
  let products: ListResourceProduct | undefined

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )

    const [
      loadAuthenticatedUser,
      loadOrganizationCustomers,
      loadUserAdminOrganizations,
      loadSubscriptionTiers,
    ] = await Promise.all([
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        // Handle unauthenticated
        return undefined
      }),
      api.organizations.listOrganizationCustomers(
        {
          id: organization.id,
          customerTypes: new Set(['subscription']),
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
      api.products
        .list(
          {
            organizationId: organization.id,
            isRecurring: true,
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
    organizationCustomers = loadOrganizationCustomers
    userAdminOrganizations = loadUserAdminOrganizations
    products = loadSubscriptionTiers
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start px-4 md:h-full md:flex-row md:gap-8 md:space-y-0 xl:gap-24">
        <div className="dark:bg-polar-950 sticky top-0 z-20 flex w-full flex-row items-center justify-between bg-white py-4 md:relative md:hidden">
          <a href="/">
            <LogoIcon className="text-blue-500 dark:text-blue-400" size={40} />
          </a>
          <PolarMenu
            authenticatedUser={authenticatedUser}
            userAdminOrganizations={userAdminOrganizations?.items ?? []}
          />
        </div>
        <div className="relative flex w-fit flex-shrink-0 flex-col justify-between py-8 md:sticky md:top-0 md:py-16">
          <OrganizationPublicSidebar
            organizationCustomers={organizationCustomers}
            organization={organization}
            userAdminOrganizations={userAdminOrganizations?.items ?? []}
            products={products?.items ?? []}
          />
        </div>
        <div className="flex h-full w-full flex-col gap-y-8 md:gap-y-16 md:py-12">
          <div className="flex w-full flex-row flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <div className="flex w-full flex-row items-center gap-x-6 overflow-x-auto md:w-fit md:overflow-x-visible">
              <div className="hidden md:flex">
                <BrandingMenu />
              </div>
              <div className="flex w-full flex-row items-center pb-2 md:pb-0">
                <OrganizationPublicPageNav organization={organization} />
              </div>
            </div>
            <div className="ml-auto hidden flex-row md:flex">
              <PolarMenu
                authenticatedUser={authenticatedUser}
                userAdminOrganizations={userAdminOrganizations?.items ?? []}
              />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
