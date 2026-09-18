'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { DataTable, DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { composeIdentities, toLiveSubscription } from './identityLive'
import { identityHref, shortDate } from './identities'
import { useVoidCustomers, useVoidIdentities } from './identityQueries'
import { getVoidData } from './mock'
import { useVoidSubscriptions } from './subscriptionQueries'
import {
  SUBSCRIPTION_STATUS_COLOR,
  SubscriptionRow,
} from './VoidIdentityTables'
import { VoidErrorBox } from './VoidShell'

interface SubscriptionListRow extends SubscriptionRow {
  identity_id: string
  identity_name: string
}

const isOpen = (status: SubscriptionListRow['status']) =>
  status === 'active' || status === 'trialing'

const columns: DataTableColumnDef<SubscriptionListRow>[] = [
  {
    id: 'identity',
    enableSorting: false,
    header: 'Identity',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text truncate>{original.identity_name}</Text>
        {original.identity_name !== original.identity_id ? (
          <Text color="muted" variant="caption" truncate>
            {original.identity_id}
          </Text>
        ) : null}
      </Box>
    ),
  },
  {
    accessorKey: 'product',
    enableSorting: false,
    header: 'Product',
    cell: ({ getValue }) => getValue() as string,
  },
  {
    accessorKey: 'status',
    enableSorting: false,
    header: 'Status',
    cell: ({ row: { original } }) => (
      <Status
        status={original.status}
        color={SUBSCRIPTION_STATUS_COLOR[original.status]}
        size="small"
      />
    ),
  },
  {
    accessorKey: 'started_at',
    enableSorting: false,
    header: 'Since',
    cell: ({ getValue }) => shortDate(getValue() as string),
  },
  {
    id: 'period',
    enableSorting: false,
    header: 'Period',
    cell: ({ row: { original } }) => (
      <Text color="muted">
        {original.ends_at
          ? `Ends ${shortDate(original.ends_at)}`
          : original.current_period_end
            ? `Renews ${shortDate(original.current_period_end)}`
            : '—'}
      </Text>
    ),
  },
]

const withIdentityName = (
  rows: Array<SubscriptionRow & { identity_id: string }>,
  names: Map<string, string>,
): SubscriptionListRow[] =>
  rows
    .map((row) => ({
      ...row,
      identity_name: names.get(row.identity_id) ?? row.identity_id,
    }))
    .toSorted((left, right) => right.started_at.localeCompare(left.started_at))

export const VoidSubscriptionsPage = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const subscriptionsQuery = useVoidSubscriptions(organization.id, {
    enabled: live,
  })
  const identitiesQuery = useVoidIdentities(organization.id, { enabled: live })
  const customersQuery = useVoidCustomers(organization.id, { enabled: live })

  const rows = useMemo(() => {
    if (!live) {
      const data = getVoidData()
      return withIdentityName(
        data.subscriptions,
        new Map(data.identities.map((identity) => [identity.id, identity.name])),
      )
    }
    return withIdentityName(
      (subscriptionsQuery.data ?? []).map(toLiveSubscription),
      new Map(
        composeIdentities(
          identitiesQuery.data ?? [],
          customersQuery.data ?? [],
        ).map((identity) => [identity.id, identity.name]),
      ),
    )
  }, [
    customersQuery.data,
    identitiesQuery.data,
    live,
    subscriptionsQuery.data,
  ])

  let active = 0
  for (const row of rows) {
    if (isOpen(row.status)) active += 1
  }

  const loading =
    live &&
    (subscriptionsQuery.isLoading ||
      identitiesQuery.isLoading ||
      customersQuery.isLoading)
  const error = live ? subscriptionsQuery.error : null

  return (
    <DashboardBody title="Subscriptions">
      {loading ? (
        <LoadingBox height={128} borderRadius="m" />
      ) : error ? (
        <VoidErrorBox message={error.message} />
      ) : (
        <Box flexDirection="column" rowGap="3xl">
          <Box
            display={{ base: 'grid', xl: 'flex' }}
            gridTemplateColumns="repeat(2, 1fr)"
            gap={{ base: 'l', md: 'xl' }}
          >
            <StatisticCard
              title="Subscriptions"
              size="lg"
              valueClassName="font-sans"
            >
              {rows.length}
            </StatisticCard>
            <StatisticCard title="Active" size="lg" valueClassName="font-sans">
              {active}
            </StatisticCard>
            <StatisticCard title="Ended" size="lg" valueClassName="font-sans">
              {rows.length - active}
            </StatisticCard>
          </Box>
          {rows.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingVertical="3xl"
              rowGap="l"
            >
              <Text color="muted">No subscriptions yet</Text>
            </Box>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={false}
              getRowId={(row) => row.id}
              onRowClick={(row) =>
                router.push(identityHref(base, row.original.identity_id))
              }
            />
          )}
        </Box>
      )}
    </DashboardBody>
  )
}
