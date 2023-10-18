import SubscriptionTierCreatePage from '@/components/Subscriptions/SubscriptionTierCreatePage'
import { useAPI } from '@/hooks/api'
import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
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
  searchParams: { type?: SubscriptionTierType }
}) {
  const api = useAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })
  return (
    <SubscriptionTierCreatePage
      organization={organization}
      type={searchParams.type}
    />
  )
}
