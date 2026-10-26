import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { MeterListSidebar } from '@/components/Meter/MeterListSidebar'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { PropsWithChildren } from 'react'

export default async function Layout(
  props: PropsWithChildren<{
    params: Promise<{ organization: string }>
  }>,
) {
  const [params, api] = await Promise.all([props.params, getServerSideAPI()])
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return (
    <MasterDetailLayout
      listView={<MeterListSidebar organization={organization} />}
    >
      {props.children}
    </MasterDetailLayout>
  )
}
