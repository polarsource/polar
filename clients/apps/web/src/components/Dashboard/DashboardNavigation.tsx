'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { NavigationContainer } from './NavigationContainer'
import {
  useFundingRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const generalRoutesList = useGeneralRoutes(org)
  const fundingRoutes = useFundingRoutes(org)
  const organizationRoutes = useOrganizationRoutes(org)

  const dashboardRoutes = [
    ...generalRoutesList,
    ...fundingRoutes,
    ...organizationRoutes,
  ]

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-6">
      <NavigationContainer routes={dashboardRoutes} />
    </div>
  )
}

export default MaintainerNavigation
