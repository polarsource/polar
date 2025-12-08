import { getServerSideAPI } from '@/utils/client/serverside'
import { DataTableSearchParams, parseSearchParams } from '@/utils/datatable'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas } from '@polar-sh/client'
import { Metadata } from 'next'
import CustomFieldsPage from './CustomFieldsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Custom Fields', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<
    DataTableSearchParams & {
      type?: schemas['CustomFieldType']
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

  const { pagination, sorting } = parseSearchParams(searchParams, [
    { id: 'slug', desc: false },
  ])

  return (
    <CustomFieldsPage
      organization={organization}
      pagination={pagination}
      sorting={sorting}
      type={searchParams.type}
    />
  )
}
