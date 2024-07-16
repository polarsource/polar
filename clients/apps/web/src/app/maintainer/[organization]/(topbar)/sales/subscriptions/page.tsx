import { EnableProductsView } from '@/components/Products/EnableProductsView'
import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlug } from '@/utils/organization'
import { SubscriptionTierType } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
    product_id?: string
    status?: Extract<SubscriptionTierType, 'active' | 'inactive'>
  }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    notFound()
  }

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'started_at', desc: true },
  ])

  if (!organization.feature_settings?.subscriptions_enabled) {
    return <EnableProductsView organization={organization} />
  }

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      subscriptionTierType={searchParams.type}
      productId={searchParams.product_id}
      subscriptionStatus={searchParams.status}
    />
  )
}
