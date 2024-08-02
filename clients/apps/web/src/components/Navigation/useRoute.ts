import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { useDashboardRoutes } from '../Dashboard/navigation'

export const useRoute = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const dashboardRoutes = useDashboardRoutes(org, true)

  const currentRoute = dashboardRoutes.find((r) => r.isActive)

  return currentRoute
}
