import { getServerSideAPI } from '@/utils/api/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlug } from '@/utils/organization'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; id: string }
  searchParams: DataTableSearchParams
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
    />
  )
}
