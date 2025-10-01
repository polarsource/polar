import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import ClientPage from './ClientPage'

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
  searchParams: Promise<DataTableSearchParams>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

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
