import { CustomerPortalSettings } from '@/components/CustomerPortal/CustomerPortalSettings'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'

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
  searchParams: {
    customer_session_token?: string
    setup_intent_client_secret?: string
    setup_intent?: string
  }
}) {
  const api = getServerSideAPI(searchParams.customer_session_token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <CustomerPortalSettings
      organization={organization}
      customerSessionToken={searchParams.customer_session_token}
      setupIntentParams={
        searchParams.setup_intent_client_secret && searchParams.setup_intent
          ? {
              setup_intent_client_secret:
                searchParams.setup_intent_client_secret,
              setup_intent: searchParams.setup_intent,
            }
          : undefined
      }
    />
  )
}
