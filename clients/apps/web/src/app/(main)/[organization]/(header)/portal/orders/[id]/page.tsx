import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { CustomerOrder, ResponseError } from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

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
  params: { organization: string; id: string }
  searchParams: { customer_session_token?: string }
}) {
  const api = getServerSideAPI(searchParams.customer_session_token)
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  let order: CustomerOrder | undefined
  try {
    order = await api.customerPortalOrders.get({ id: params.id })
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
      order={order}
      customerSessionToken={searchParams.customer_session_token}
    />
  )
}
