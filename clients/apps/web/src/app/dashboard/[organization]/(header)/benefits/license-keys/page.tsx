import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { ClientPage } from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Benefits', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: DataTableSearchParams
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'expires_at', desc: true },
  ])

  return (
    <ClientPage
      pagination={pagination}
      sorting={sorting}
      organization={organization}
    />
  )
}
