'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Organization,
  PolarSubscriptionSchemasUser,
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import {
  Avatar,
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
  FormattedDateTime,
} from 'polarkit/components/ui/atoms'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from 'polarkit/datatable'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useEffect, useMemo, useState } from 'react'
import SubscriptionTiersSelect from './SubscriptionTiersSelect'
import {
  getSubscriptionTiersByType,
  subscriptionStatusDisplayNames,
  tiersTypeDisplayNames,
} from './utils'

interface SubscribersPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  subscriptionTierId?: string
  subscriptionTierType?: SubscriptionTierType
}

const SubscribersPage: React.FC<SubscribersPageProps> = ({
  organization,
  pagination,
  sorting,
  subscriptionTierId,
  subscriptionTierType,
}) => {
  const subscriptionTiers = useSubscriptionTiers(organization.name)
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.data?.items ?? []),
    [subscriptionTiers.data],
  )

  const filter = subscriptionTierType || subscriptionTierId || 'all'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      if (Object.values(SubscriptionTierType).includes(filter as any)) {
        params.append('type', filter)
      } else {
        params.append('subscription_tier_id', filter)
      }
    }
    return params
  }

  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState<
    Subscription[] | undefined
  >()
  const [pageCount, setPageCount] = useState<number | undefined>()

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `/maintainer/${
        organization.name
      }/subscriptions/subscribers?${getSearchParams(
        updatedPagination,
        sorting,
        filter,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `/maintainer/${
        organization.name
      }/subscriptions/subscribers?${getSearchParams(
        pagination,
        updatedSorting,
        filter,
      )}`,
    )
  }

  const setFilter = (filter: string) => {
    router.push(
      `/maintainer/${
        organization.name
      }/subscriptions/subscribers?${getSearchParams(
        pagination,
        sorting,
        filter,
      )}`,
    )
  }

  useEffect(() => {
    api.subscriptions
      .searchSubscriptions({
        platform: organization.platform,
        organizationName: organization.name,
        ...getAPIParams(pagination, sorting),
        ...(subscriptionTierId ? { subscriptionTierId } : {}),
        ...(subscriptionTierType ? { type: subscriptionTierType } : {}),
      })
      .then((subscriptions) => {
        setSubscriptions(subscriptions.items || [])
        setPageCount(subscriptions.pagination.max_page)
      })
  }, [
    organization,
    pagination,
    sorting,
    subscriptionTierId,
    subscriptionTierType,
  ])

  const columns: DataTableColumnDef<Subscription>[] = [
    {
      accessorKey: 'user',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: (props) => {
        const user = props.getValue() as PolarSubscriptionSchemasUser
        return (
          <div className="flex flex-row gap-2">
            <Avatar avatar_url={user.avatar_url} name={user.username} />
            <div className="fw-medium">{user.username}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: (props) =>
        subscriptionStatusDisplayNames[props.getValue() as SubscriptionStatus],
    },
    {
      accessorKey: 'started_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscription date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      accessorKey: 'current_period_end',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Renewal date" />
      ),
      cell: (props) => {
        const datetime = props.getValue() as string | null
        return datetime ? <FormattedDateTime datetime={datetime} /> : '—'
      },
    },
    {
      accessorKey: 'price_amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Monthly price" />
      ),
      cell: (props) => (
        <>
          ${getCentsInDollarString(props.getValue() as number, undefined, true)}
        </>
      ),
    },
    {
      accessorKey: 'subscription_tier.type',
      id: 'subscription_tier_type',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier group" />
      ),
      cell: (props) =>
        tiersTypeDisplayNames[props.getValue() as SubscriptionTierType],
    },
    {
      accessorKey: 'subscription_tier',
      id: 'subscription_tier',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier" />
      ),
      cell: (props) => {
        const tier = props.getValue() as SubscriptionTier
        return (
          <>
            {tier.name}
            {tier.is_archived && (
              <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                Archived
              </span>
            )}
          </>
        )
      },
    },
  ]

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Subscribers</h2>
          <div className="w-1/3 md:w-1/6">
            <SubscriptionTiersSelect
              tiersByType={subscriptionTiersByType}
              value={subscriptionTierType || subscriptionTierId || 'all'}
              onChange={setFilter}
            />
          </div>
        </div>
        {subscriptions && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={subscriptions}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default SubscribersPage
