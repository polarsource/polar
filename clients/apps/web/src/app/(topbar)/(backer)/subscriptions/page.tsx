import { getServerSideAPI } from '@/utils/api/serverside'
import { Platforms, UserRead } from '@polar-sh/sdk'
import ClientPage from './ClientPage'

export default async function Page() {
  const api = getServerSideAPI()
  let authenticatedUser: UserRead

  try {
    authenticatedUser = await api.users.getAuthenticated({ cache: 'no-store' })
  } catch (e) {}

  const subscriptions = await api.subscriptions.searchSubscribedSubscriptions({
    subscriberUserId: authenticatedUser!.id ?? '',
    limit: 100,
    platform: Platforms.GITHUB,
  })

  return <ClientPage subscriptions={subscriptions.items || []} />
}
