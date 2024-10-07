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
    <div className="flex flex-col gap-y-10">
      <NavigationContainer
        routes={[
          ...generalRoutesList,
          ...fundingRoutes,
          ...communityRoutes,
          ...organizationRoutes,
        ]}
      />
    </div>
  )
}

export default MaintainerNavigation
