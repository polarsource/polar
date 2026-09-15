import OrganizationPermissionGuard from '@/components/Auth/OrganizationPermissionGuard'

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
      permission="analytics:read"
      standalone
    >
      {children}
    </OrganizationPermissionGuard>
  )
}
