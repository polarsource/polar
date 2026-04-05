import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import UsagePage from './UsagePage'

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
  searchParams: Promise<{
    customer_session_token?: string
    member_session_token?: string
  }>
}) {
  const { customer_session_token, member_session_token, ...searchParams } =
    await props.searchParams
  const params = await props.params
  const token = customer_session_token ?? member_session_token
  const api = await getServerSideAPI(token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  const { response: customerResponse } = await api.GET(
    '/v1/customer-portal/customers/me',
    { cache: 'no-store' },
  )

  if (customerResponse.status === 401) {
    redirect(
      `/${organization.slug}/portal/request?${new URLSearchParams(searchParams)}`,
    )
  }

  return (
    <UsagePage
      organization={organization}
      customerSessionToken={token as string}
    />
  )
}
