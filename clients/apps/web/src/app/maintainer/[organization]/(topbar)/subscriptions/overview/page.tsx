import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/api'
import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
import SubscriptionsOverview from './SubscriptionsOverview'

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
  searchParams: { type?: SubscriptionTierType; subscription_tier_id?: string }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const startOfMonth = new Date()
  startOfMonth.setUTCHours(0, 0, 0, 0)
  startOfMonth.setUTCDate(1)

  const startOfMonthSixMonthsAgo = new Date()
  startOfMonthSixMonthsAgo.setUTCHours(0, 0, 0, 0)
  startOfMonthSixMonthsAgo.setUTCDate(1)
  startOfMonthSixMonthsAgo.setUTCMonth(startOfMonth.getMonth() - 5)

  return (
    <DashboardBody>
      <SubscriptionsOverview
        organization={organization}
        startDate={startOfMonthSixMonthsAgo}
        endDate={startOfMonth}
        subscriptionTierType={searchParams.type}
        subscriptionTierId={searchParams.subscription_tier_id}
      />
    </DashboardBody>
  )
}
