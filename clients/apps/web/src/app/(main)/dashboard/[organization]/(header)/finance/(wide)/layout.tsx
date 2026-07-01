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
        message="You don't have permission to view finance for this organization. Ask an admin if you need access."
      >
        {children}
      </OrganizationPermissionGuard>
    </DashboardBody>
  )
}
