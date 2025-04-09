import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Products', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams & { query?: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'name', desc: false }],
    20,
  )

  return (
    <ClientPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      query={searchParams.query}
    />
  )
}
