'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useContext, useMemo } from 'react'
import { IdentitiesMakeup } from './Identities/IdentitiesMakeup'
import { IdentitiesMovers } from './Identities/IdentitiesMovers'
import { IdentitiesRunway } from './Identities/IdentitiesRunway'
import { IdentitiesUsage } from './Identities/IdentitiesUsage'
import {
  concentration,
  kindMakeup,
  makeup,
  movers,
  runway,
} from './Identities/insights'
import { useVoidDataSource } from './dataSource'
import { buildTree, rollup } from './identities'
import { composeIdentities } from './identityLive'
import {
  useVoidCustomers,
  useVoidIdentities,
  useVoidIdentityUsage,
} from './identityQueries'
import { getVoidData } from './mock'

export const VoidIdentitiesPage = () => {
  const { organization } = useContext(OrganizationContext)
  const source = useVoidDataSource()
  const live = source === 'live'

  if (live) {
    return (
      <LiveIdentitiesPage
        organizationId={organization.id}
        base={`/void/dashboard/${organization.slug}`}
      />
    )
  }

  return <FixtureIdentitiesPage base={`/void/dashboard/${organization.slug}`} />
}

const FixtureIdentitiesPage = ({ base }: { base: string }) => {
  const data = useMemo(() => getVoidData(), [])
  const tree = useMemo(() => buildTree(data.identities), [data])
  const rolled = useMemo(
    () =>
      rollup(
        tree,
        Object.fromEntries(
          data.identities.map((identity) => [identity.id, identity.usage]),
        ),
      ),
    [tree, data],
  )
  const usageConcentration = useMemo(
    () => concentration(tree, rolled, 5),
    [tree, rolled],
  )
  const moving = useMemo(() => movers(tree), [tree])
  const credits = useMemo(() => runway(tree, rolled), [tree, rolled])
  const kinds = useMemo(() => makeup(data.identities), [data])

  return (
    <IdentitiesLayout>
      <IdentitiesUsage tree={tree} concentration={usageConcentration} />
      <IdentitiesMovers movers={moving} base={base} />
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="3xl">
        <IdentitiesRunway entries={credits} base={base} />
        <IdentitiesMakeup shares={kinds} />
      </Grid>
    </IdentitiesLayout>
  )
}

const LiveIdentitiesPage = ({
  organizationId,
  base,
}: {
  organizationId: string
  base: string
}) => {
  const identitiesQuery = useVoidIdentities(organizationId)
  const customersQuery = useVoidCustomers(organizationId)
  const usageQuery = useVoidIdentityUsage(organizationId)
  const identities = useMemo(
    () =>
      identitiesQuery.data
        ? composeIdentities(identitiesQuery.data, customersQuery.data ?? [])
        : [],
    [identitiesQuery.data, customersQuery.data],
  )
  const tree = useMemo(() => buildTree(identities), [identities])
  const usage = usageQuery.data?.usage
  const cadence = usageQuery.data?.cadence
  const rolled = useMemo(() => rollup(tree, usage ?? {}), [tree, usage])
  const usageConcentration = useMemo(
    () => concentration(tree, rolled, 5),
    [tree, rolled],
  )
  const moving = useMemo(() => movers(tree, cadence), [tree, cadence])
  const kinds = useMemo(
    () => kindMakeup(identities, usage),
    [identities, usage],
  )
  const error = identitiesQuery.error
  const loading = identitiesQuery.isLoading

  return (
    <IdentitiesLayout>
      {loading ? (
        <Box height={128} borderRadius="m" backgroundColor="background-card" />
      ) : error ? (
        <Box
          borderRadius="m"
          backgroundColor="background-warning"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-warning"
          padding="l"
        >
          <Text>{error.message}</Text>
        </Box>
      ) : identities.length === 0 ? (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          paddingVertical="3xl"
          rowGap="l"
        >
          <Text color="muted">No identities yet</Text>
        </Box>
      ) : (
        <>
          {usageQuery.isError ? (
            <Text color="muted">Usage could not be loaded.</Text>
          ) : (
            <IdentitiesUsage
              tree={tree}
              concentration={usageConcentration}
              cadence={cadence}
            />
          )}
          <IdentitiesMovers movers={moving} base={base} />
          <IdentitiesMakeup shares={kinds} />
        </>
      )}
    </IdentitiesLayout>
  )
}

const IdentitiesLayout = ({ children }: { children: ReactNode }) => (
  <MasterDetailLayoutContent
    header={
      <Text variant="heading-xs" as="h1">
        Identities
      </Text>
    }
  >
    <Box flexDirection="column" rowGap="4xl">
      {children}
    </Box>
  </MasterDetailLayoutContent>
)
