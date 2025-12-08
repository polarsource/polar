import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import SubscriptionsPage from './SubscriptionsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscriptions', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<
    DataTableSearchParams & {
      product_id?: string
      status?: 'active' | 'canceled' | 'any'
      cancel_at_period_end?: 'all' | 'true' | 'false'
      metadata?: string[]
    }
  >
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'started_at', desc: true }],
    50,
  )

  const metadata = searchParams.metadata
    ? Array.isArray(searchParams.metadata)
      ? searchParams.metadata
      : [searchParams.metadata]
    : undefined

  return (
    <SubscriptionsPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={searchParams.product_id}
      subscriptionStatus={searchParams.status ?? 'active'}
      cancelAtPeriodEnd={searchParams.cancel_at_period_end ?? 'all'}
      metadata={metadata}
    />
  )
}
