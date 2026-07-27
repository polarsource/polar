import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { DashboardBody } from '@/components/Layout/DashboardLayout'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ organization: string }>
}) {
  const { organization } = await params

  return (
    <DashboardBody>
      <OrganizationPermissionGuard
        organizationSlug={organization}
        permission="finance:read"
      >
        {children}
      </OrganizationPermissionGuard>
    </DashboardBody>
  )
}
