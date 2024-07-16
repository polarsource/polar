import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlug } from '@/utils/organization'
import { ProductPriceType } from '@polar-sh/sdk'
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
    product_id?: string
    product_price_type?: ProductPriceType
  }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(api, params.organization)

  if (!organization) {
    notFound()
  }

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      productId={searchParams.product_id}
      productPriceType={searchParams.product_price_type}
    />
  )
}
