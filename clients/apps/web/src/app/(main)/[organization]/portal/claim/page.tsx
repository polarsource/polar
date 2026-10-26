import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import type { Metadata } from 'next'
import ClaimPage from './ClaimPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `Claim Your Seat | ${organization.name}`,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ token?: string }>
}) {
  // Get organization without requiring authentication (like /request page)
  const [params, { token, ...searchParams }, api] = await Promise.all([
    props.params,
    props.searchParams,
    getServerSideAPI(),
  ])
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
    searchParams,
  )

  return <ClaimPage organization={organization} invitationToken={token} />
}
