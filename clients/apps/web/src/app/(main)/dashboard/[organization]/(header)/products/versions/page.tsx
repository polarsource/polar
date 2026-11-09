import { MasterDetailIndex } from '@/components/Layout/MasterDetailIndex'
import { EmptyState } from '@/components/Shared/EmptyState'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { HistoryRounded } from '@polar-sh/orbit/icons'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Versions', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  // The list is newest first, with the draft ahead of every published version
  const { data } = await api.GET('/v1/catalogs/', {
    params: { query: { organization_id: organization.id, limit: 1 } },
  })

  if (data?.items.length) {
    return (
      <MasterDetailIndex
        redirectTo={`/dashboard/${organization.slug}/products/versions/${data.items[0].id}`}
      />
    )
  }

  return (
    <EmptyState
      icon={<HistoryRounded />}
      title="No versions yet"
      description="Apply your config to save a draft, then publish it to create a version."
    />
  )
}
