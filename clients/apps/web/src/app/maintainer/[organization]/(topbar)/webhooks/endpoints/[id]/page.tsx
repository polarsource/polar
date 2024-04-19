import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Platforms } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; id: string }
  searchParams: DataTableSearchParams
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const endpoint = await api.webhooks.getWebhookEndpoint(
    {
      id: params.id,
    },
    { cache: 'no-cache' },
  )

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      endpoint={endpoint}
      organization={organization}
      pagination={pagination}
      sorting={sorting}
    />
  )
}
