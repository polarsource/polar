import LogoIcon from '@/components/Brand/LogoIcon'
import PolarMenu from '@/components/Layout/PolarMenu'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { getServerSideAPI } from '@/utils/api/serverside'
import {
  ListResourceOrganization,
  ListResourceOrganizationCustomer,
  OrganizationCustomerType,
  ListResourceProduct,
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
  let organizationCustomers: ListResourceOrganizationCustomer | undefined
  let userAdminOrganizations: ListResourceOrganization | undefined
  let products: ListResourceProduct | undefined

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      {
        next: {
          revalidate: 30,
          tags: [`organization:${params.organization}`]
        }
      },
    )
    if (!organization) {
      notFound()
    }


    const [
      loadAuthenticatedUser,
      loadUserAdminOrganizations,
      loadSubscriptionTiers,
    ] = await Promise.all([
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        // Handle unauthenticated
        return undefined
      }),
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
    userAdminOrganizations = loadUserAdminOrganizations
    products = loadSubscriptionTiers
  } catch (e) {
    notFound()
  }

  const subscriberSettings = organization.profile_settings?.subscribe ?? {
    show_count: true,
    count_free: true,
  }
  if (subscriberSettings.show_count) {
    let customerTypes: OrganizationCustomerType[] = [OrganizationCustomerType.PAID_SUBSCRIPTION]
    if (subscriberSettings.count_free) {
      customerTypes.push(OrganizationCustomerType.FREE_SUBSCRIPTION)
    }

    organizationCustomers = await api.organizations.listOrganizationCustomers({
      id: organization.id,
      customerTypes: new Set(customerTypes),
      limit: 3,
    }, cacheConfig)
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
