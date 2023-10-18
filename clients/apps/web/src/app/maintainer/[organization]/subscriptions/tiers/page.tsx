import TiersPage from '@/components/Subscriptions/TiersPage'
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
}: {
  params: { organization: string }
}) {
  const api = useAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })
  const subscriptionTiers = await api.subscriptions.searchSubscriptionTiers({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  return (
    <TiersPage
      subscriptionTiers={subscriptionTiers}
      organization={organization}
    />
  )
}
