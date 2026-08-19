import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'
import { permissionDeniedMessage } from '@/utils/permissions'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ organization: string }>
}) {
  const { organization } = await params

  return (
    <OrganizationPermissionGuard
      organizationSlug={organization}
      permission="products:manage"
      message={permissionDeniedMessage('products:manage')}
      standalone
    >
      {children}
    </OrganizationPermissionGuard>
  )
}
