'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  ArrowDownOnSquareIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/outline'
import {
  Organization,
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { getServerURL } from 'polarkit/api'
import {
  Avatar,
  Button,
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
import { useSearchSubscriptions, useSubscriptionTiers } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useMemo } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import ImportSubscribersModal from './ImportSubscribersModal'
import SubscriptionStatusSelect from './SubscriptionStatusSelect'
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
  subscriptionStatus?: Extract<SubscriptionStatus, 'active' | 'canceled'>
}

const SubscribersPage: React.FC<SubscribersPageProps> = ({
  organization,
  pagination,
  sorting,
  subscriptionTierId,
  subscriptionTierType,
  subscriptionStatus,
}) => {
  const subscriptionTiers = useSubscriptionTiers(organization.name)
  const subscriptionTiersByType = useMemo(
    () => getSubscriptionTiersByType(subscriptionTiers.data?.items ?? []),
    [subscriptionTiers.data],
  )

  const filter = subscriptionTierType || subscriptionTierId || 'all'
  const status = subscriptionStatus || 'active'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
    status: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      if (Object.values(SubscriptionTierType).includes(filter as any)) {
        params.append('type', filter)
      } else {
        params.append('subscription_tier_id', filter)
      }
    }

    params.append('status', status)

    return params
  }

  const router = useRouter()
  // const [subscriptions, setSubscriptions] = useState<
  //   Subscription[] | undefined
  // >()
  // const [pageCount, setPageCount] = useState<number | undefined>()

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
        status,
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
        status,
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
        status,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    router.push(
      `/maintainer/${
        organization.name
      }/subscriptions/subscribers?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
      )}`,
    )
  }

  const subscriptionsHook = useSearchSubscriptions({
    platform: organization.platform,
    organizationName: organization.name,
    ...getAPIParams(pagination, sorting),
    ...(subscriptionTierId ? { subscriptionTierId } : {}),
    ...(subscriptionTierType ? { type: subscriptionTierType } : {}),
    ...{ active: status === 'active' },
  })

  const subscriptions = subscriptionsHook.data?.items || []
  const pageCount = subscriptionsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Subscription>[] = [
    {
      id: 'subscriber',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscriber" />
      ),
      cell: ({ row: { original: subscription } }) => {
        const user = subscription.user
        const organization = subscription.organization
        return (
          <div className="flex flex-row items-center gap-2">
            {organization && (
              <>
                <Avatar
                  avatar_url={organization.avatar_url}
                  name={organization.name}
                />
                <div className="fw-medium">{organization.name}</div>
              </>
            )}
            {!organization && (
              <>
                <Avatar avatar_url={user.avatar_url} name={user.public_name} />
                {user.github_username ? (
                  <div className="fw-medium">@{user.github_username}</div>
                ) : null}
                <div className="fw-medium">{user.email}</div>
              </>
            )}
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

  const {
    isShown: importSubscribersIsShow,
    hide: hideImportSubscribers,
    show: showImportSubscribers,
  } = useModal()

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/api/v1/subscriptions/subscriptions/export?organization_name=${
        organization.name
      }&platform=${organization.platform}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Subscribers</h2>

          <div className="flex items-center gap-2">
            <div className="w-full min-w-[180px]">
              <SubscriptionStatusSelect
                statuses={['active', 'canceled']}
                value={subscriptionStatus || 'active'}
                onChange={setStatus}
              />
            </div>
            <div className="w-full min-w-[180px]">
              <SubscriptionTiersSelect
                tiersByType={subscriptionTiersByType}
                value={subscriptionTierType || subscriptionTierId || 'all'}
                onChange={setFilter}
              />
            </div>
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
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={showImportSubscribers}
            className="flex items-center"
            variant={'secondary'}
          >
            <ArrowDownOnSquareIcon className="-ml-1 mr-2 h-5 w-5" />
            <span>Import</span>
          </Button>

          <Button
            onClick={onExport}
            className="flex flex-row items-center "
            variant={'secondary'}
          >
            <ArrowUpOnSquareIcon className="-ml-1 mr-2 h-5 w-5" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <Modal
        isShown={importSubscribersIsShow}
        hide={hideImportSubscribers}
        modalContent={
          <ImportSubscribersModal
            hide={hideImportSubscribers}
            organization={organization}
          />
        }
      />
    </DashboardBody>
  )
}

export default SubscribersPage
