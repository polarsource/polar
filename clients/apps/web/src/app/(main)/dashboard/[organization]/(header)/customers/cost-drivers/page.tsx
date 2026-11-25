import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { CostDriversPage } from './CostDriversPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Cost Drivers', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )

  return (
    <OrganizationPermissionGuard
      organizationSlug={params.organization}
      permission="analytics:read"
    >
      <CostDriversPage organization={organization} />
    </OrganizationPermissionGuard>
  )
}
