'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { EmptyState } from '@/components/Shared/EmptyState'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { Users } from 'lucide-react'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import {
  buildTree,
  chainOf,
  describeKinds,
  rollupUsage,
  shortDate,
  walk,
} from './identities'
import { getVoidData } from './mock'
import {
  EntitlementsTable,
  EventsTable,
  MetersTable,
  SubscriptionsTable,
  TableSection,
} from './VoidIdentityTables'
import { VoidIdentityTree } from './VoidIdentityTree'
import { VoidIdentityUsage } from './VoidIdentityUsage'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

const spendSeries = (cadence: number[]): ParsedMetricsResponse => {
  const end = new Date()
  const periods = cadence.map((value, index) => ({
    timestamp: subDays(end, cadence.length - 1 - index),
    revenue: value,
  }))
  return {
    periods: periods as unknown as ParsedMetricPeriod[],
    totals: { revenue: cadence.reduce((sum, value) => sum + value, 0) },
    metrics: {
      revenue: { slug: 'revenue', display_name: 'Spend', type: 'currency' },
    },
  }
}

export const VoidIdentityPage = ({ identityId }: { identityId: string }) => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const data = useMemo(() => getVoidData(), [])
  const tree = useMemo(() => buildTree(data.identities), [data])
  const rolled = useMemo(() => rollupUsage(tree), [tree])
  const chain = useMemo(() => chainOf(tree, identityId), [tree, identityId])

  const focused = chain[0]
  const rootIdentity = chain.at(-1)
  const root = rootIdentity ? tree.byId.get(rootIdentity.id) : undefined

  if (!focused || !root || !rootIdentity) {
    return (
      <DashboardBody title="Identity">
        <EmptyState
          icon={<Users />}
          title="Unknown identity"
          description="No identity with this id exists in the tree."
        />
      </DashboardBody>
    )
  }

  const focusedNode = tree.byId.get(focused.id)!
  const isRoot = focused.id === rootIdentity.id
  const below = walk(focusedNode)
    .slice(1)
    .map((node) => node.identity)
  const chainIds = new Set(chain.map((identity) => identity.id))
  const subscriptions = data.subscriptions.filter(
    (subscription) => subscription.identity_id === focused.id,
  )
  const entitlements = data.entitlements.filter((entitlement) =>
    chainIds.has(entitlement.identity_id),
  )
  const events = data.events.filter((event) => event.identity_id === focused.id)
  const rootUsage = rolled[rootIdentity.id]
  const treeSize = walk(root).length

  const meta = isRoot
    ? [
        'Customer',
        below.length > 0 ? describeKinds(below) : 'No members',
        ...(focused.note ? [focused.note] : []),
      ]
    : [
        focused.kind,
        `${chain.length - 1} hop${chain.length === 2 ? '' : 's'} to ${rootIdentity.name}`,
        ...(below.length > 0 ? [describeKinds(below)] : []),
        ...(focused.note ? [focused.note] : []),
      ]

  return (
    <DashboardBody
      title={
        <Box flexDirection="column" rowGap="xs">
          <Link href={`${base}/identities`}>
            <Text color="muted" variant="caption">
              Identities
            </Text>
          </Link>
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
            {usd(rolled[focused.id])}
          </StatisticCard>
          <StatisticCard
            title="Own usage / 30 days"
            size="lg"
            valueClassName="font-sans"
          >
            {usd(focused.usage)}
          </StatisticCard>
          {isRoot ? (
            <StatisticCard
              title="Paid / 30 days"
              size="lg"
              valueClassName="font-sans"
            >
              {usd(focused.spend)}
            </StatisticCard>
          ) : (
            <StatisticCard
              title="Share of customer"
              size="lg"
              valueClassName="font-sans"
            >
              {rootUsage > 0
                ? `${Math.round((rolled[focused.id] / rootUsage) * 100)}%`
                : '0%'}
            </StatisticCard>
          )}
          <StatisticCard
            title="First seen"
            size="lg"
            valueClassName="font-sans"
          >
            {shortDate(focused.created_at)}
          </StatisticCard>
        </Box>

        {isRoot ? (
          <VoidIdentityUsage root={root} rolled={rolled} base={base} />
        ) : null}

        {isRoot ? (
          <MetricChartBox
            metric="revenue"
            interval="day"
            data={spendSeries(focused.cadence)}
            shareable={false}
            exportable={false}
          />
        ) : null}

        {isRoot ? null : (
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
              base={base}
            />
          </TableSection>
        )}

        <TableSection title="Subscriptions">
          <SubscriptionsTable rows={subscriptions} />
        </TableSection>

        <TableSection title="Entitlements" caption="Resolved up the chain">
          <EntitlementsTable rows={entitlements} identityId={focused.id} />
        </TableSection>

        {isRoot ? null : (
          <TableSection title="Meters">
            <MetersTable meters={focused.meters} />
          </TableSection>
        )}

        <TableSection title="Events">
          <EventsTable rows={events} />
        </TableSection>
      </Box>
    </DashboardBody>
  )
}
