'use client'

import { VoidHero } from '@/components/Void/VoidHero'
import { VoidIdentities } from '@/components/Void/VoidIdentities'
import { VoidInfrastructure } from '@/components/Void/VoidInfrastructure'
import { VoidPerformance } from '@/components/Void/VoidPerformance'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidHero organizationId={organization.id} />
      <VoidIdentities organizationId={organization.id} />
      <VoidPerformance organizationId={organization.id} />
      <VoidInfrastructure />
    </Box>
  )
}
