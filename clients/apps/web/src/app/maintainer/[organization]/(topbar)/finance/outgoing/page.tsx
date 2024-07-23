import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Finance - Outgoing', // " | Polar is added by the template"
  }
}

export default async function Page({
  searchParams,
  params,
}: {
  searchParams: DataTableSearchParams
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
    cacheConfig,
  )

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'created_at', desc: true },
  ])

  return (
    <ClientPage
      pagination={pagination}
      sorting={sorting}
      organization={organization}
    />
  )
}
