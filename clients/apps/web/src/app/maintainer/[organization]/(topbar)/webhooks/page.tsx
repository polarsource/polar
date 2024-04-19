import { getServerSideAPI } from '@/utils/api/serverside'
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

  const endpoints = await api.webhooks.searchWebhookEndpoints(
    {
      organizationId: organization.id,
    },
    { cache: 'no-cache' },
  )

  return (
    <ClientPage
      endpoints={endpoints?.items ?? []}
      organization={organization}
    />
  )
}
