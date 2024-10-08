'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { NavigationContainer } from './NavigationContainer'
import {
  useCommunityRoutes,
  useFundingRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const generalRoutesList = useGeneralRoutes(org)
  const fundingRoutes = useFundingRoutes(org)
  const communityRoutes = useCommunityRoutes(org)
  const organizationRoutes = useOrganizationRoutes(org)

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-8">
      <NavigationContainer routes={generalRoutesList} />
      <NavigationContainer title="Funding" routes={fundingRoutes} />
      <NavigationContainer title="Community" routes={communityRoutes} />
      <NavigationContainer title="Organization" routes={organizationRoutes} />
    </div>
  )
}

export default MaintainerNavigation
