'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext, useMemo } from 'react'
import { IdentitiesMakeup } from './Identities/IdentitiesMakeup'
import { IdentitiesMovers } from './Identities/IdentitiesMovers'
import { IdentitiesRunway } from './Identities/IdentitiesRunway'
import { IdentitiesUsage } from './Identities/IdentitiesUsage'
import { concentration, makeup, movers, runway } from './Identities/insights'
import { buildTree, rollupUsage } from './identities'
import { getVoidData } from './mock'

export const VoidIdentitiesPage = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const data = useMemo(() => getVoidData(), [])
  const tree = useMemo(() => buildTree(data.identities), [data])
  const rolled = useMemo(() => rollupUsage(tree), [tree])
  const usageConcentration = useMemo(
    () => concentration(tree, rolled, 5),
    [tree, rolled],
  )
  const moving = useMemo(() => movers(tree), [tree])
  const credits = useMemo(() => runway(tree, rolled), [tree, rolled])
  const kinds = useMemo(() => makeup(data.identities), [data])

  return (
    <MasterDetailLayoutContent
      header={
        <Text variant="heading-xs" as="h1">
          Identities
        </Text>
      }
    >
      <Box flexDirection="column" rowGap="4xl">
        <IdentitiesUsage tree={tree} concentration={usageConcentration} />
        <IdentitiesMovers movers={moving} base={base} />
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="3xl">
          <IdentitiesRunway entries={credits} base={base} />
          <IdentitiesMakeup shares={kinds} />
        </Grid>
      </Box>
    </MasterDetailLayoutContent>
  )
}
