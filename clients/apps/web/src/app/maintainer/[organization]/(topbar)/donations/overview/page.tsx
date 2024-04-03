import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const donations = await api.donations.searchDonations({
    toOrganizationId: organization.id,
    limit: 5,
  })

  return (
    <ClientPage organization={organization} donations={donations.items ?? []} />
  )
}
