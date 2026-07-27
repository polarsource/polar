import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { CustomerListSidebar } from '@/components/Customer/CustomerListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { PropsWithChildren } from 'react'

export default async function Layout(
  props: PropsWithChildren<{
    params: Promise<{ organization: string }>
  }>,
) {
  const { organization } = await props.params

  return (
    <OrganizationPermissionGuard
      organizationSlug={organization}
      permission="customers:read"
      standalone
    >
      <CustomersLayoutShell organizationSlug={organization}>
        {props.children}
      </CustomersLayoutShell>
    </OrganizationPermissionGuard>
  )
}

async function CustomersLayoutShell({
  organizationSlug,
  children,
}: PropsWithChildren<{ organizationSlug: string }>) {
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
  )

  return (
    <MasterDetailLayout
      listView={<CustomerListSidebar organization={organization} />}
    >
      {children}
    </MasterDetailLayout>
  )
}
