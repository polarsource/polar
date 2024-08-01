'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { NavigationContainer } from './NavigationContainer'
import { useMaintainerRoutes } from './navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const navs = useMaintainerRoutes(org ?? undefined)

  if (!org) {
    return <></>
  }

  return <NavigationContainer title="Maintainer" routes={navs} />
}

export default MaintainerNavigation
