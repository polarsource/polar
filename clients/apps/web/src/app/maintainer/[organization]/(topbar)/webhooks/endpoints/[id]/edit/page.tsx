import { getServerSideAPI } from '@/utils/api/serverside'
import { Platforms } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const api = getServerSideAPI()

  const endpoint = await api.webhooks.getWebhookEndpoint(
    {
      id: params.id,
    },
    { cache: 'no-cache' },
  )

  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  return <ClientPage endpoint={endpoint} organization={organization} />
}
