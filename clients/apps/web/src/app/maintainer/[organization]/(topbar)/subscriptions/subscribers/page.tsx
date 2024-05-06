import { EnableSubscriptionsView } from '@/components/Subscriptions/EnableSubscriptionsView'
import SubscribersPage from '@/components/Subscriptions/SubscribersPage'
import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
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
  searchParams: DataTableSearchParams & {
    type?: SubscriptionTierType
    subscription_tier_id?: string
    status?: Extract<SubscriptionTierType, 'active' | 'inactive'>
  }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'started_at', desc: true },
  ])

  if (!organization.subscriptions_enabled) {
    return <EnableSubscriptionsView organization={organization} />
  }

  return (
    <SubscribersPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      subscriptionTierType={searchParams.type}
      subscriptionTierId={searchParams.subscription_tier_id}
      subscriptionStatus={searchParams.status}
    />
  )
}
