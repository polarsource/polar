import PublicLayout from '@/components/Layout/PublicLayout'
import { OrganizationPublicHeader } from '@/components/Organization/OrganizationPublicHeader'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import {
  ListResourceOrganizationCustomer,
  ListResourceProduct,
  OrganizationCustomerType,
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

  let organizationCustomers: ListResourceOrganizationCustomer | undefined
  let products: ListResourceProduct | undefined

  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.profile_settings?.enabled) {
    notFound()
  }

  const authenticatedUser = await getAuthenticatedUser(api)
  const userOrganizations = await getUserOrganizations(api)

  try {
    const loadSubscriptionTiers = await api.products
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
      })
    products = loadSubscriptionTiers
  } catch (e) {
    notFound()
  }

  const subscriberSettings = organization.profile_settings?.subscribe ?? {
    show_count: true,
    count_free: true,
  }
  if (subscriberSettings.show_count) {
    let customerTypes: OrganizationCustomerType[] = [
      OrganizationCustomerType.PAID_SUBSCRIPTION,
    ]
    if (subscriberSettings.count_free) {
      customerTypes.push(OrganizationCustomerType.FREE_SUBSCRIPTION)
    }

    organizationCustomers = await api.organizations.customers(
      {
        id: organization.id,
        customerTypes: new Set(customerTypes),
        limit: 3,
      },
      cacheConfig,
    )
  }

  return (
    <PublicLayout wide>
      <div className="flex flex-grow flex-col items-center py-16">
        <OrganizationPublicHeader
          organizationCustomers={
            subscriberSettings.show_count ? organizationCustomers : undefined
          }
          organization={organization}
          userOrganizations={userOrganizations ?? []}
          products={products?.items ?? []}
        />
      </div>
      <OrganizationPublicPageNav organization={organization} />
      <div className="flex h-full flex-grow flex-col gap-y-8 md:gap-y-16 md:py-12">
        {children}
      </div>
    </PublicLayout>
  )
}
