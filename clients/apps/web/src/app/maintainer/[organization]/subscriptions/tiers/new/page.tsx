import SubscriptionTierCreatePage from '@/components/Subscriptions/SubscriptionTierCreatePage'
import { useAPI } from '@/hooks/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'

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

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: { subscription_group?: string }
}) {
  const api = useAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })
  const subscriptionGroups = await api.subscriptions.searchSubscriptionGroups({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })
  return (
    <SubscriptionTierCreatePage
      subscriptionGroups={subscriptionGroups.items || []}
      subscriptionGroup={searchParams.subscription_group}
      organization={organization}
    />
  )
}
