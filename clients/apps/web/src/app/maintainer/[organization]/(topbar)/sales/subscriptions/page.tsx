import { EnableSubscriptionsView } from '@/components/Subscriptions/EnableSubscriptionsView'
import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { Platforms, SubscriptionTierType } from '@polar-sh/sdk'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

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

  if (!organization.feature_settings?.subscriptions_enabled) {
    return <EnableSubscriptionsView organization={organization} />
  }

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      subscriptionTierType={searchParams.type}
      subscriptionTierId={searchParams.subscription_tier_id}
      subscriptionStatus={searchParams.status}
    />
  )
}
