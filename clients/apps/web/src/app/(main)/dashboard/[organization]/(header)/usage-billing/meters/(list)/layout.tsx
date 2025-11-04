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
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return (
    <MasterDetailLayout
      listViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      listView={<MeterListSidebar organization={organization} />}
    >
      {props.children}
    </MasterDetailLayout>
  )
}
