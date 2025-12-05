import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import SalesPage from './SalesPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Orders', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<
    DataTableSearchParams & {
      product_id?: string[] | string
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
    [{ id: 'created_at', desc: true }],
    50,
  )

  const productId = searchParams.product_id
    ? Array.isArray(searchParams.product_id)
      ? searchParams.product_id
      : [searchParams.product_id]
    : undefined

  const metadata = searchParams.metadata
    ? Array.isArray(searchParams.metadata)
      ? searchParams.metadata
      : [searchParams.metadata]
    : undefined

  return (
    <SalesPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={productId}
      metadata={metadata}
    />
  )
}
