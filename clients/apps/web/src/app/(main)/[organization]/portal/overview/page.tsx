import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  cache: 'no-store' as RequestCache,
  next: {
    tags: ['customer_portal'],
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
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
  const { organization, products } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  const {
    data: subscriptions,
    error: subscriptionsError,
    response: subscriptionsResponse,
  } = await api.GET('/v1/customer-portal/subscriptions/', {
    params: {
      query: {
        organization_id: organization.id,
        active: true,
        limit: 100,
      },
    },
    ...cacheConfig,
  })

  const {
    data: oneTimePurchases,
    error: oneTimePurchasesError,
    response: oneTimePurchasesResponse,
  } = await api.GET('/v1/customer-portal/orders/', {
    params: {
      query: {
        organization_id: organization.id,
        product_billing_type: 'one_time',
        limit: 100,
      },
    },
    ...cacheConfig,
  })

  if (
    subscriptionsResponse.status === 401 ||
    oneTimePurchasesResponse.status === 401
  ) {
    redirect(`/${organization.slug}/portal/request`)
  }

  if (subscriptionsError) {
    throw subscriptionsError
  }

  if (oneTimePurchasesError) {
    throw oneTimePurchasesError
  }

  return (
    <ClientPage
      organization={organization}
      products={products}
      subscriptions={subscriptions}
      oneTimePurchases={oneTimePurchases}
      customerSessionToken={searchParams.customer_session_token}
    />
  )
}
