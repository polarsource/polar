import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { BenefitListSidebar } from '@/components/Benefit/BenefitListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
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
      permission="products:manage"
      standalone
    >
      <MasterDetailLayout
        listView={<BenefitListSidebar organization={organization} />}
      >
        {props.children}
      </MasterDetailLayout>
    </OrganizationPermissionGuard>
  )
}
