import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getProductById } from '@/utils/product'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClientPage } from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout Links', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; id: string }
  searchParams: DataTableSearchParams
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const product = await getProductById(api, params.id)

  if (!product) {
    return notFound()
  }

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      organization={organization}
      product={product}
      pagination={pagination}
      sorting={sorting}
    />
  )
}
