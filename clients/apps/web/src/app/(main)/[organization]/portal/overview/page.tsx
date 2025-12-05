import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import OverviewPage from './OverviewPage'

const cacheConfig = {
  cache: 'no-store' as RequestCache,
  next: {
    tags: ['customer_portal'],
  },
}

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
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

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ customer_session_token?: string }>
}) {
  const { customer_session_token, ...searchParams } = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI(customer_session_token)
  const { organization, products } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  const [
    {
      data: subscriptions,
      error: subscriptionsError,
      response: subscriptionsResponse,
    },
    {
      data: benefitGrants,
      error: benefitGrantsError,
      response: benefitGrantsResponse,
    },
    {
      data: claimedSubscriptions,
      error: claimedSubscriptionsError,
      response: claimedSubscriptionsResponse,
    },
  ] = await Promise.all([
    api.GET('/v1/customer-portal/subscriptions/', {
      params: {
        query: {
          limit: 100,
        },
      },
      ...cacheConfig,
    }),

    api.GET('/v1/customer-portal/benefit-grants/', {
      params: {
        query: {
          limit: 100,
        },
      },
      ...cacheConfig,
    }),

    api.GET('/v1/customer-portal/seats/subscriptions', {
      ...cacheConfig,
    }),
  ])

  if (
    subscriptionsResponse.status === 401 ||
    benefitGrantsResponse.status === 401 ||
    claimedSubscriptionsResponse.status === 401
  ) {
    redirect(
      `/${organization.slug}/portal/request?${new URLSearchParams(searchParams)}`,
    )
  }

  if (subscriptionsError) {
    throw subscriptionsError
  }

  if (benefitGrantsError) {
    throw benefitGrantsError
  }

  if (claimedSubscriptionsError) {
    throw claimedSubscriptionsError
  }

  return (
    <OverviewPage
      organization={organization}
      products={products}
      subscriptions={subscriptions}
      claimedSubscriptions={claimedSubscriptions ?? []}
      benefitGrants={benefitGrants}
      customerSessionToken={customer_session_token as string}
    />
  )
}
