import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { notFound } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { VersionListSidebar } from './VersionList'

export default async function Layout(
  props: PropsWithChildren<{
    params: Promise<{ organization: string }>
  }>,
) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  if (!organization.feature_settings?.config_as_code_enabled) {
    notFound()
  }

  return (
    <MasterDetailLayout
      listView={<VersionListSidebar organization={organization} />}
    >
      {props.children}
    </MasterDetailLayout>
  )
}
