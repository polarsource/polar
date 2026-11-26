import { useAuth } from '@/hooks/auth'
import { useParams } from 'next/navigation'

export const useOptionalDashboardOrganization = () => {
  const params = useParams<{ organization?: string }>()
  const { userOrganizations } = useAuth()
  return userOrganizations.find((org) => org.slug === params?.organization)
}

export const useDashboardOrganization = () => {
  const organization = useOptionalDashboardOrganization()
  if (!organization) {
    throw new Error(
      'useDashboardOrganization must be used under /dashboard/[organization].',
    )
  }
  return organization
}
