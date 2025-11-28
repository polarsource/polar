import { CheckoutLinkListSidebar } from '@/components/CheckoutLinks/CheckoutLinkListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
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
      listView={<CheckoutLinkListSidebar organization={organization} />}
      wrapperClassName="max-w-(--breakpoint-sm)!"
    >
      {props.children}
    </MasterDetailLayout>
  )
}
