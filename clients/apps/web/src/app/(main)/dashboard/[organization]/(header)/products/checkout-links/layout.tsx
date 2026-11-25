import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { CheckoutLinkListSidebar } from '@/components/CheckoutLinks/CheckoutLinkListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { permissionDeniedMessage } from '@/utils/permissions'
import { PropsWithChildren } from 'react'

export default async function Layout(
  props: PropsWithChildren<{
    params: Promise<{ organization: string }>
  }>,
) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
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
