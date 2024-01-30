import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page() {
  const api = getServerSideAPI()
  const subscriptions = await api.subscriptions.searchSubscribedSubscriptions({
    limit: 100,
    platform: Platforms.GITHUB,
  })

  return <ClientPage subscriptions={subscriptions.items || []} />
}
