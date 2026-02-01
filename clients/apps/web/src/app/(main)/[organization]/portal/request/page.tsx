import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import RequestPage from './RequestPage'

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
    title: `Customer Portal | ${organization.name}`, // " | Spaire is added by the template"
    openGraph: {
      title: `Customer Portal | ${organization.name} on Spaire`,
      description: `Customer Portal | ${organization.name} on Spaire`,
      siteName: 'Spaire',
      type: 'website',
      images: [
        {
          url: `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} on Spaire`,
        },
      ],
      card: 'summary_large_image',
      title: `Customer Portal | ${organization.name} on Spaire`,
      description: `Customer Portal | ${organization.name} on Spaire`,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    customer_session_token?: string
    email?: string
  }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI(searchParams.customer_session_token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return <RequestPage organization={organization} email={searchParams.email} />
}
