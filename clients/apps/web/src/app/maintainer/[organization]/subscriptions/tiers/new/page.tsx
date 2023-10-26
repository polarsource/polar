import SubscriptionTierCreatePage from '@/components/Subscriptions/SubscriptionTierCreatePage'
import { getServerSideAPI } from '@/utils/api'
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
  const api = getServerSideAPI()

  const [organization, benefits] = await Promise.all([
    api.organizations.lookup({
      organizationName: params.organization,
      platform: Platforms.GITHUB,
    }),
    api.subscriptions.searchSubscriptionBenefits({
      organizationName: params.organization,
      platform: Platforms.GITHUB,
    }),
  ])

  return (
    <SubscriptionTierCreatePage
      organization={organization}
      benefits={benefits}
      type={searchParams.type}
    />
  )
}
