import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { CheckoutLinkListSidebar } from '@/components/CheckoutLinks/CheckoutLinkListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { permissionDeniedMessage } from '@/utils/permissions'
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
    <OrganizationPermissionGuard
      organizationSlug={params.organization}
      permission="products:read"
      message={permissionDeniedMessage('products:read')}
      standalone
    >
      <MasterDetailLayout
        listView={<CheckoutLinkListSidebar organization={organization} />}
        wrapperClassName="max-w-(--breakpoint-sm)!"
      >
        {props.children}
      </MasterDetailLayout>
    </OrganizationPermissionGuard>
  )
}
