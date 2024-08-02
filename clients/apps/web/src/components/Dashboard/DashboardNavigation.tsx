'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Face } from '@mui/icons-material'
import { useContext } from 'react'
import { NavigationContainer } from './NavigationContainer'
import {
  useAccountRoutes,
  useCommunityRoutes,
  useFundingRoutes,
  useGeneralRoutes,
} from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const generalRoutesList = useGeneralRoutes(org)
  const fundingRoutes = useFundingRoutes(org)
  const communityRoutes = useCommunityRoutes(org)
  const accountRoutes = useAccountRoutes(org)

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-10">
      <NavigationContainer routes={generalRoutesList} />
      <NavigationContainer title="Funding" routes={fundingRoutes} />
      <NavigationContainer
        title="Community"
        routes={communityRoutes}
        dummyRoutes={[{ title: 'Audience', icon: <Face fontSize="inherit" /> }]}
      />
      <NavigationContainer title="Account" routes={accountRoutes} />
    </div>
  )
}

export default MaintainerNavigation
