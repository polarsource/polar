import { useOptionalDashboardOrganization } from '@/hooks/dashboardOrganization'
import { useDashboardRoutes } from '../Dashboard/navigation'

export const useRoute = () => {
  const org = useOptionalDashboardOrganization()

  const dashboardRoutes = useDashboardRoutes(org, true)

  const currentRoute = dashboardRoutes.find((r) => r.isActive)

  const currentSubRoute = currentRoute?.subs?.find(
    (r) => 'isActive' in r && r.isActive,
  )

  return {
    currentRoute,
    currentSubRoute,
  }
}
