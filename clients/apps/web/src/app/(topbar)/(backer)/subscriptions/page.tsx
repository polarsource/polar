import { getServerSideAPI } from '@/utils/api/serverside'
import ClientPage from './ClientPage'

export default async function Page() {
  const api = getServerSideAPI()
  const subscriptions = await api.users.listSubscriptions({
    active: true,
    limit: 100,
  })

  return <ClientPage subscriptions={subscriptions.items || []} />
}
