import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import {
  useDashboardRoutes,
  useMaintainerRoutes,
} from '../Dashboard/navigation'

export const useRoute = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const personalOrg = orgContext?.personalOrganization
  const adminOrgs = orgContext?.adminOrganizations ?? []
  const isOrgAdmin = adminOrgs.some((o) => org && o.id === org.id)
  const isPersonal = Boolean(org && personalOrg && org.id === personalOrg.id)

  const maintainerRoutes = useMaintainerRoutes(org, true)
  const dashboardRoutes = useDashboardRoutes(
    org,
    org ? isPersonal : true,
    isOrgAdmin ?? false,
  )

  const routes = [...maintainerRoutes, ...dashboardRoutes]
  const currentRoute = routes.find((r) => r.isActive)

  return currentRoute
}
