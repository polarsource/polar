import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas } from '@polar-sh/client'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkouts', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams & {
    product_id?: string | string[]
    customer_id?: string
    status?: schemas['CheckoutStatus']
    query?: string
  }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'created_at', desc: true }],
    50,
  )

  const productId = searchParams.product_id
    ? Array.isArray(searchParams.product_id)
      ? searchParams.product_id
      : [searchParams.product_id]
    : undefined

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={productId}
      customerId={searchParams.customer_id}
      status={searchParams.status}
      query={searchParams.query}
    />
  )
}
