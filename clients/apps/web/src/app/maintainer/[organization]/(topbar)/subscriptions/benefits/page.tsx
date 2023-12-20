import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `${params.organization}`, // " | Polar is added by the template"
  }
}

export default async function Page() {
  const api = getServerSideAPI()

  const user = await api.users.getAuthenticated()

  const [subscriptions] = await Promise.all([
    api.subscriptions.searchSubscriptions({
      organizationName: undefined,
      subscriberUserId: user.id,
      active: true,
      limit: 100,
      platform: Platforms.GITHUB,
    }),
  ])

  const subscriptionTiers = await Promise.all(
    subscriptions.items?.map((subscription) =>
      api.subscriptions.lookupSubscriptionTier({
        subscriptionTierId: subscription.subscription_tier_id,
      }),
    ) ?? [],
  )
  return <ClientPage subscriptionTiers={subscriptionTiers} />
}
