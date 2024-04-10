import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Platforms } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams
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

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      organization={organization}
      donations={donations.items ?? []}
      pagination={pagination}
      sorting={sorting}
    />
  )
}
