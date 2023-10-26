import TiersPage from '@/components/Subscriptions/TiersPage'
import { getServerSideAPI } from '@/utils/api'
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
  const api = getServerSideAPI()

  const [organization, subscriptionTiers] = await Promise.all([
    api.organizations.lookup({
      organizationName: params.organization,
      platform: Platforms.GITHUB,
    }),
    api.subscriptions.searchSubscriptionTiers({
      organizationName: params.organization,
      platform: Platforms.GITHUB,
    }),
  ])

  return (
    <TiersPage
      subscriptionTiers={subscriptionTiers}
      organization={organization}
    />
  )
}
