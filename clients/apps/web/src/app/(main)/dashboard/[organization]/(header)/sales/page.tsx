import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Orders', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams & {
    product_id?: string[] | string
    metadata?: string[]
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

  const metadata = searchParams.metadata
    ? Array.isArray(searchParams.metadata)
      ? searchParams.metadata
      : [searchParams.metadata]
    : undefined

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={productId}
      metadata={metadata}
    />
  )
}
