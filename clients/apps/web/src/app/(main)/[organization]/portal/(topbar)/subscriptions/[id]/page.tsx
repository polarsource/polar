import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ClientPage from './ClientPage'

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
  params: { organization: string; id: string }
  searchParams: { customer_session_token?: string }
}) {
  const api = getServerSideAPI(searchParams.customer_session_token)
  const { organization, products } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  const {
    data: subscription,
    error,
    response,
  } = await api.GET('/v1/customer-portal/subscriptions/{id}', {
    params: {
      path: {
        id: params.id,
      },
    },
    cache: 'no-cache',
    next: {
      tags: [`customer_portal`],
    },
  })

  if (response.status === 401) {
    redirect(`/${organization.slug}/portal/request`)
  }

  if (error) {
    throw error
  }

  return (
    <ClientPage
      organization={organization}
      products={products}
      subscription={subscription}
      customerSessionToken={searchParams.customer_session_token}
    />
  )
}
