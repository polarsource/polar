import { getServerSideAPI } from '@/utils/api/serverside'
import ClientPage from './ClientPage'

export default async function Page({
  params,
}: {
  params: { organization: string; id: string }
}) {
  const api = getServerSideAPI()

  const endpoint = await api.webhooks.getWebhookEndpoint({
    id: params.id,
  })

  return <ClientPage endpoint={endpoint} />
}
