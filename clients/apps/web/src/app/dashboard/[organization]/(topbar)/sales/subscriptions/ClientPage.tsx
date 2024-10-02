'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AmountLabel from '@/components/Shared/AmountLabel'
import SubscriptionStatusSelect from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import { useListSubscriptions, useProducts } from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { FileDownloadOutlined } from '@mui/icons-material'
import {
  Organization,
  Product,
  Subscription,
  SubscriptionStatus,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import React from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  subscriptionStatus?: Extract<SubscriptionStatus, 'active' | 'canceled'>
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  subscriptionStatus,
}) => {
  const subscriptionTiers = useProducts(organization.id, { isRecurring: true })

  const filter = productId || 'all'
  const status = subscriptionStatus || 'active'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
    status: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      params.append('product_id', filter)
    }

    params.append('status', status)

    return params
  }

  const router = useRouter()

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
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
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
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        updatedSorting,
        filter,
        status,
      )}`,
    )
  }

  const setFilter = (filter: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
      )}`,
    )
  }

  const subscriptionsHook = useListSubscriptions(organization.id, {
    ...getAPIParams(pagination, sorting),
    ...(productId ? { productId } : {}),
    ...{ active: status === 'active' },
  })

  const subscriptions = subscriptionsHook.data?.items || []
  const pageCount = subscriptionsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Subscription>[] = [
    {
      id: 'user',
      accessorKey: 'user',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: subscription } }) => {
        const user = subscription.user
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar avatar_url={user.avatar_url} name={user.public_name} />
            {user.github_username ? (
              <div className="fw-medium">@{user.github_username}</div>
            ) : null}
            <div className="fw-medium">{user.email}</div>
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
      cell: ({ getValue, row: { original: subscription } }) => {
        return (
          <>
            {subscriptionStatusDisplayNames[getValue() as SubscriptionStatus]}
            {subscription.cancel_at_period_end &&
              subscription.current_period_end && (
                <span className="ml-2 shrink-0 rounded-lg border border-yellow-200 bg-yellow-100 px-1.5 text-xs text-yellow-600 dark:border-yellow-600 dark:bg-yellow-700 dark:text-yellow-300">
                  Cancels at{' '}
                  <FormattedDateTime
                    datetime={subscription.current_period_end}
                  />
                </span>
              )}
          </>
        )
      },
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
      accessorKey: 'product',
      id: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tier" />
      ),
      cell: (props) => {
        const tier = props.getValue() as Product
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
    {
      id: 'amount',
      accessorKey: 'amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: subscription } }) => {
        if (!subscription.amount || !subscription.currency) {
          return '—'
        }

        return (
          <AmountLabel
            amount={subscription.amount}
            currency={subscription.currency}
            interval={subscription.recurring_interval}
          />
        )
      },
    },
  ]

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/subscriptions/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody>
      <ShadowBoxOnMd className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-medium">Overview</h1>
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
                products={subscriptionTiers.data?.items || []}
                value={productId || 'all'}
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
            isLoading={subscriptionsHook}
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={onExport}
            className="flex flex-row items-center "
            variant={'secondary'}
          >
            <FileDownloadOutlined className="mr-2" fontSize="small" />
            <span>Export</span>
          </Button>
        </div>
      </ShadowBoxOnMd>
    </DashboardBody>
  )
}

export default ClientPage
