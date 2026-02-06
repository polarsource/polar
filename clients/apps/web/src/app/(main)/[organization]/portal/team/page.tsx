import { CustomerPortalTeam } from '@/components/CustomerPortal/CustomerPortalTeam'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'

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
    title: `Team | ${organization.name}`,
    openGraph: {
      title: `Team | ${organization.name} on Spaire`,
      description: `Manage team members | ${organization.name} on Spaire`,
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
          alt: `${organization.name} on Spaire`,
        },
      ],
      card: 'summary_large_image',
      title: `Team | ${organization.name} on Spaire`,
      description: `Manage team members | ${organization.name} on Spaire`,
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
  const { customer_session_token, member_session_token } =
    await props.searchParams
  const params = await props.params
  const token = customer_session_token ?? member_session_token
  const api = await getServerSideAPI(token)
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return <CustomerPortalTeam customerSessionToken={token} />
}
