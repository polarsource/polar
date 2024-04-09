import SubscriptionTierCreatePage from '@/components/Subscriptions/SubscriptionTierCreatePage'
import { getServerSideAPI } from '@/utils/api'
import { Platforms, SubscriptionTierCreateTypeEnum } from '@polar-sh/sdk'
import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  return {
    title: `${params.organization}`, // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: { type?: SubscriptionTierCreateTypeEnum }
}) {
  const api = getServerSideAPI()

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
