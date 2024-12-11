import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import {
  ListResourceCustomerOrder,
  ListResourceCustomerSubscription,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `Customer Portal | ${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `Customer Portal | ${organization.name} on Polar`,
      description: `Customer Portal | ${organization.name} on Polar`,
      siteName: 'Polar',
      type: 'website',
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `Customer Portal | ${organization.name} on Polar`,
      description: `Customer Portal | ${organization.name} on Polar`,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: { customer_session_token?: string }
}) {
  const api = getServerSideAPI(searchParams.customer_session_token)
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  let subscriptions: ListResourceCustomerSubscription | undefined
  let oneTimePurchases: ListResourceCustomerOrder | undefined
  try {
    subscriptions = await api.customerPortalSubscriptions.list(
      { organizationId: organization.id, active: true, limit: 100 },
      cacheConfig,
    )
    oneTimePurchases = await api.customerPortalOrders.list({
      organizationId: organization.id,
      limit: 100,
    })
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return (
    <ClientPage
      organization={organization}
      subscriptions={subscriptions}
      orders={oneTimePurchases}
    />
  )
}
