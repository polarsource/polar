'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Face } from '@mui/icons-material'
import { useContext } from 'react'
import { NavigationContainer } from './NavigationContainer'
import {
  useAccountRoutes,
  useCommunityRoutes,
  useFundingRoutes,
  useShopRoutes,
} from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const shopRoutes = useShopRoutes(org)
  const fundingRoutes = useFundingRoutes(org)
  const communityRoutes = useCommunityRoutes(org)
  const accountRoutes = useAccountRoutes(org)

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-10">
      <NavigationContainer title="Commerce" routes={shopRoutes} />
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
