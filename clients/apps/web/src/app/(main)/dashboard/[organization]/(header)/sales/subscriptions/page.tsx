import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscriptions', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams & {
    product_id?: string
    status?: 'active' | 'canceled' | 'any'
  }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'started_at', desc: true }],
    50,
  )

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={searchParams.product_id}
      subscriptionStatus={searchParams.status ?? 'active'}
    />
  )
}
