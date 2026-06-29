import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { isDisputeStatus } from '@/utils/dispute'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DisputesPage from './DisputesPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Disputes',
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<DataTableSearchParams & { status?: string | string[] }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.feature_settings?.disputes_enabled) {
    notFound()
  }

  const { pagination, sorting } = parseSearchParams(
    searchParams,
    [{ id: 'created_at', desc: true }],
    50,
  )

  const rawStatus = Array.isArray(searchParams.status)
    ? searchParams.status[0]
    : searchParams.status
  const status = rawStatus && isDisputeStatus(rawStatus) ? rawStatus : 'any'

  return (
    <DisputesPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      status={status}
    />
  )
}
