'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Users } from 'lucide-react'
import { useContext, useMemo } from 'react'
import { VoidRequestError } from './api'
import {
  buildTree,
  chainOf,
  describeKinds,
  rollup,
  shortDate,
  walk,
} from './identities'
import {
  composeIdentities,
  toIdentity,
  toLiveEvent,
  toLiveSubscription,
} from './identityLive'
import {
  useVoidCustomers,
  useVoidIdentities,
  useVoidIdentity,
  useVoidIdentityActivities,
  useVoidIdentityEntitlements,
  useVoidIdentityEvents,
  useVoidIdentitySnapshot,
  useVoidIdentitySubscriptions,
  useVoidIdentityUsage,
} from './identityQueries'
import { VoidIdentityActivities } from './VoidIdentityActivities'
import { VoidIdentitySenses } from './VoidIdentitySenses'
import {
  EntitlementsTable,
  EventsTable,
  SnapshotMetersTable,
  SubscriptionsTable,
  TableSection,
} from './VoidIdentityTables'
import { VoidIdentityTree } from './VoidIdentityTree'
import { VoidIdentityUsage } from './VoidIdentityUsage'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

export const VoidIdentityPageLive = ({
  identityId,
}: {
  identityId: string
}) => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const identityQuery = useVoidIdentity(organization.id, identityId)
  const listQuery = useVoidIdentities(organization.id)
  const customersQuery = useVoidCustomers(organization.id)
  const snapshotQuery = useVoidIdentitySnapshot(organization.id, identityId)
  const subscriptionsQuery = useVoidIdentitySubscriptions(
    organization.id,
    identityId,
  )
  const entitlementsQuery = useVoidIdentityEntitlements(
    organization.id,
    identityId,
  )
  const eventsQuery = useVoidIdentityEvents(organization.id, identityId)
  const activitiesQuery = useVoidIdentityActivities(organization.id, identityId)
  const usageQuery = useVoidIdentityUsage(organization.id)

  const identities = useMemo(
    () =>
      listQuery.data
        ? composeIdentities(listQuery.data, customersQuery.data ?? [])
        : [],
    [listQuery.data, customersQuery.data],
  )
  const tree = useMemo(() => buildTree(identities), [identities])
  const usage = usageQuery.data?.usage
  const cadence = usageQuery.data?.cadence
  const spend = usageQuery.data?.spend
  const rolled = useMemo(() => rollup(tree, usage ?? {}), [tree, usage])

  const customerById = useMemo(
    () =>
      new Map(
        (customersQuery.data ?? []).map((customer) => [
          customer.external_id,
          customer,
        ]),
      ),
    [customersQuery.data],
  )

  const focused = useMemo(() => {
    if (!identityQuery.data) return undefined
    return toIdentity(
      identityQuery.data,
      identityQuery.data.parent_external_id === null
        ? customerById.get(identityQuery.data.external_id)
        : undefined,
    )
  }, [identityQuery.data, customerById])

  if (identityQuery.isLoading) {
    return (
      <MasterDetailLayoutContent
        header={
          <Text variant="heading-xs" as="h1">
            Identity
          </Text>
        }
      >
        <Box height={128} borderRadius="m" backgroundColor="background-card" />
      </MasterDetailLayoutContent>
    )
  }

  const notFound =
    identityQuery.error instanceof VoidRequestError &&
    identityQuery.error.status === 404

  if (identityQuery.error && !notFound) {
    return (
      <MasterDetailLayoutContent
        header={
          <Text variant="heading-xs" as="h1">
            Identity
          </Text>
        }
      >
        <Box
          borderRadius="m"
          backgroundColor="background-warning"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-warning"
          padding="l"
        >
          <Text>{identityQuery.error.message}</Text>
        </Box>
      </MasterDetailLayoutContent>
    )
  }

  if (notFound || !focused) {
    return (
      <MasterDetailLayoutContent
        header={
          <Text variant="heading-xs" as="h1">
            Identity
          </Text>
        }
      >
        <EmptyState
          icon={<Users />}
          title="Unknown identity"
          description="No identity with this id exists in the tree."
        />
      </MasterDetailLayoutContent>
    )
  }

  const chain = chainOf(tree, focused.id)
  const rootIdentity = chain.at(-1)
  const root = rootIdentity ? tree.byId.get(rootIdentity.id) : undefined
  const focusedNode = tree.byId.get(focused.id)
  const isRoot = focused.parent_id === null
  const below = focusedNode
    ? walk(focusedNode)
        .slice(1)
        .map((node) => node.identity)
    : (identityQuery.data?.children ?? []).map((child) => toIdentity(child))
  const hops = chain.length > 0 ? chain.length - 1 : 0
  const rootName = rootIdentity?.name ?? identityQuery.data?.chain.at(-1)
  const treeSize = root ? walk(root).length : below.length + 1
  const rootUsage = rootIdentity ? (rolled[rootIdentity.id] ?? 0) : 0
  const focusedUsage = rolled[focused.id] ?? 0
  const ownUsage = usage?.[focused.id] ?? 0
  const paid = spend?.[focused.id]
  const usageKnown = usageQuery.isSuccess
  const usageLabel = usageKnown ? usd(focusedUsage) : '—'
  const ownLabel = usageKnown ? usd(ownUsage) : '—'
  const paidLabel = paid === undefined ? undefined : usd(paid)

  const meta = isRoot
    ? [
        'Customer',
        below.length > 0 ? describeKinds(below) : 'No members',
        ...(focused.note ? [focused.note] : []),
      ]
    : [
        focused.kind,
        rootName
          ? `${hops} hop${hops === 1 ? '' : 's'} to ${rootName}`
          : focused.kind,
        ...(below.length > 0 ? [describeKinds(below)] : []),
        ...(focused.note ? [focused.note] : []),
      ]

  const subscriptions = (subscriptionsQuery.data ?? []).map(toLiveSubscription)
  const entitlements = (entitlementsQuery.data?.entitlements ?? []).map(
    (grant) => ({
      slug: grant.slug,
      name: grant.name,
      product: grant.product_slug,
      subscription_id: grant.subscription_id,
      identity_id: grant.external_identity_id,
    }),
  )
  const events = (eventsQuery.data?.items ?? []).map(toLiveEvent)
  const activities = activitiesQuery.data
  const snapshot = snapshotQuery.data

  return (
    <MasterDetailLayoutContent
      header={
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h1">
            {focused.name}
          </Text>
          <Text color="muted">{meta.join(' · ')}</Text>
        </Box>
      }
    >
      <Box flexDirection="column" rowGap="3xl">
        <Box
          display={{ base: 'grid', xl: 'flex' }}
          gridTemplateColumns="repeat(2, 1fr)"
          gap={{ base: 'l', md: 'xl' }}
        >
          <StatisticCard
            title="Usage / 30 days"
            size="lg"
            valueClassName="font-sans"
          >
            {usageLabel}
          </StatisticCard>
          <StatisticCard
            title="Own usage / 30 days"
            size="lg"
            valueClassName="font-sans"
          >
            {ownLabel}
          </StatisticCard>
          {isRoot && paidLabel !== undefined ? (
            <StatisticCard
              title="Paid / 30 days"
              size="lg"
              valueClassName="font-sans"
            >
              {paidLabel}
            </StatisticCard>
          ) : !isRoot ? (
            <StatisticCard
              title="Share of customer"
              size="lg"
              valueClassName="font-sans"
            >
              {usageKnown
                ? rootUsage > 0
                  ? `${Math.round((focusedUsage / rootUsage) * 100)}%`
                  : '0%'
                : '—'}
            </StatisticCard>
          ) : null}
          <StatisticCard
            title="First seen"
            size="lg"
            valueClassName="font-sans"
          >
            {shortDate(focused.created_at)}
          </StatisticCard>
        </Box>

        {usageQuery.isError ? (
          <Text color="muted">Usage could not be loaded.</Text>
        ) : focusedNode ? (
          <VoidIdentityUsage
            root={focusedNode}
            rolled={rolled}
            base={base}
            cadence={cadence}
            ownUsage={usage}
          />
        ) : null}

        {activities && activities.by_activity.length > 0 ? (
          <VoidIdentityActivities mix={activities} costAsCurrency={false} />
        ) : null}

        {(snapshot?.senses?.length ?? 0) > 0 ? (
          <VoidIdentitySenses
            rows={(snapshot?.senses ?? []).map((sense) => ({
              slug: sense.slug,
              when: sense.when,
              over:
                sense.over.type === 'run'
                  ? 'this run'
                  : `last ${sense.over.amount} ${sense.over.unit}${sense.over.amount === 1 ? '' : 's'}`,
              noul: sense.noul,
              span_count: sense.span_count,
            }))}
          />
        ) : null}

        {root ? (
          <TableSection
            title="Identities"
            caption={
              treeSize === 1
                ? 'Just this identity'
                : `${treeSize} identities, rolled up figures include every identity below`
            }
          >
            <VoidIdentityTree
              root={root}
              focusedId={focused.id}
              rolled={rolled}
              ownUsage={usage}
              base={base}
            />
          </TableSection>
        ) : null}

        <TableSection title="Subscriptions">
          <SubscriptionsTable rows={subscriptions} />
        </TableSection>

        <TableSection title="Entitlements" caption="Resolved up the chain">
          <EntitlementsTable rows={entitlements} identityId={focused.id} />
        </TableSection>

        {!isRoot && snapshot ? (
          <TableSection title="Meters" caption="Current balances">
            <SnapshotMetersTable meters={snapshot.meters} />
          </TableSection>
        ) : null}

        <TableSection title="Events">
          <EventsTable rows={events} />
        </TableSection>
      </Box>
    </MasterDetailLayoutContent>
  )
}
