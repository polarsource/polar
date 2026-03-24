'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import SubscriptionCancellationSelect from '@/components/Subscriptions/SubscriptionCancellationSelect'
import { SubscriptionStatus as SubscriptionStatusComponent } from '@/components/Subscriptions/SubscriptionStatus'
import SubscriptionStatusSelect from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import { useProducts, useSubscriptions } from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  productId?: string
  subscriptionStatus?:
    | Extract<schemas['SubscriptionStatus'], 'active' | 'canceled'>
    | 'any'
  cancelAtPeriodEnd?: 'all' | 'true' | 'false'
  metadata?: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  productId,
  subscriptionStatus,
  cancelAtPeriodEnd,
  metadata,
}) => {
  const [selectedSubscriptionState, setSelectedSubscriptionState] =
    useState<RowSelectionState>({})

  const subscriptionTiers = useProducts(organization.id, { is_recurring: true })

  const filter = productId || 'all'
  const status = subscriptionStatus || 'active'
  const cancelAtPeriodEndFilter = cancelAtPeriodEnd || 'all'
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    filter: string,
    status: string,
    cancelAtPeriodEndFilter: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (filter !== 'all') {
      params.append('product_id', filter)
    }

    params.append('status', status)

    if (cancelAtPeriodEndFilter !== 'all') {
      params.append('cancel_at_period_end', cancelAtPeriodEndFilter)
    }

    if (metadata) {
      metadata.forEach((key) => params.append('metadata', key))
    }

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
        cancelAtPeriodEndFilter,
      )}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    let updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    // Add secondary sort on ends_at when sorting by status
    const statusSort = updatedSorting.find((s) => s.id === 'status')
    if (statusSort) {
      const hasSecondarySortOnEndsAt = updatedSorting.some(
        (s) => s.id === 'ends_at',
      )
      if (!hasSecondarySortOnEndsAt) {
        updatedSorting = [
          statusSort,
          { id: 'ends_at', desc: statusSort.desc },
          ...updatedSorting.filter((s) => s.id !== 'status'),
        ]
      }
    }

    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        updatedSorting,
        filter,
        status,
        cancelAtPeriodEndFilter,
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
        cancelAtPeriodEndFilter,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    const newCancelAtPeriodEnd =
      status === 'active' ? cancelAtPeriodEndFilter : 'all'
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
        newCancelAtPeriodEnd,
      )}`,
    )
  }

  const setCancelAtPeriodEnd = (cancelAtPeriodEnd: string) => {
    router.push(
      `/dashboard/${organization.slug}/sales/subscriptions?${getSearchParams(
        pagination,
        sorting,
        filter,
        status,
        cancelAtPeriodEnd,
      )}`,
    )
  }

  const subscriptionsHook = useSubscriptions(organization.id, {
    ...getAPIParams(pagination, sorting),
    ...(productId ? { product_id: productId } : {}),
    ...(status !== 'any' ? { active: status === 'active' } : {}),
    ...(cancelAtPeriodEndFilter === 'false'
      ? { cancel_at_period_end: false }
      : cancelAtPeriodEndFilter === 'true'
        ? { cancel_at_period_end: true }
        : {}),
  })

  const subscriptions = subscriptionsHook.data?.items || []
  const rowCount = subscriptionsHook.data?.pagination.total_count ?? 0
  const pageCount = subscriptionsHook.data?.pagination.max_page ?? 1

  const selectedSubscription = subscriptions.find(
    (subscription) => selectedSubscriptionState[subscription.id],
  )

  useEffect(() => {
    if (selectedSubscription) {
      router.push(
        `/dashboard/${organization.slug}/sales/subscriptions/${selectedSubscription.id}`,
      )
    }
  }, [selectedSubscription, organization, router])

  const columns: DataTableColumnDef<schemas['Subscription']>[] = [
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: subscription } }) => {
        const customer = subscription.customer
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              avatar_url={customer.avatar_url}
              name={customer.name || customer.email}
            />
            <div className="fw-medium overflow-hidden text-ellipsis">
              {customer.email}
            </div>
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
      cell: ({ row: { original: subscription } }) => {
        return <SubscriptionStatusComponent subscription={subscription} />
      },
    },
    {
      accessorKey: 'started_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subscription Date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      accessorKey: 'current_period_end',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Renewal Date" />
      ),
      cell: ({
        getValue,
        row: {
          original: { status, cancel_at_period_end },
        },
      }) => {
        const datetime = getValue() as string | null
        const willRenew =
          (status === 'active' || status === 'trialing') &&
          !cancel_at_period_end
        return datetime && willRenew ? (
          <FormattedDateTime datetime={datetime} />
        ) : (
          '—'
        )
      },
    },
    {
      accessorKey: 'product',
      id: 'product',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: (props) => {
        const tier = props.getValue() as schemas['Product']
        return (
          <div className="flex flex-row items-center gap-2">
            {tier.name}
            {tier.is_archived && (
              <Status
                status="Archived"
                className="bg-red-100 text-xs text-red-500 dark:bg-red-950"
              />
            )}
          </div>
        )
      },
    },
    ...(metadata
      ? metadata.map<DataTableColumnDef<schemas['Subscription']>>((key) => ({
          accessorKey: `metadata.${key}`,
          enableSorting: false,
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={key} />
          ),
          cell: (props) => (
            <span className="font-mono">{props.getValue() as string}</span>
          ),
        }))
      : []),
  ]

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/subscriptions/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div className="w-auto">
              <SubscriptionStatusSelect
                statuses={['active', 'canceled']}
                value={subscriptionStatus || 'any'}
                onChange={setStatus}
              />
            </div>
            {status === 'active' && (
              <div className="w-auto">
                <SubscriptionCancellationSelect
                  value={cancelAtPeriodEnd || 'all'}
                  onChange={setCancelAtPeriodEnd}
                />
              </div>
            )}
            <div className="w-auto">
              <SubscriptionTiersSelect
                products={subscriptionTiers.data?.items || []}
                value={productId || 'all'}
                onChange={setFilter}
              />
            </div>
          </div>
          <Button
            onClick={onExport}
            className="flex flex-row items-center"
            variant={'secondary'}
            wrapperClassNames="gap-x-2"
          >
            <FileDownloadOutlined fontSize="inherit" />
            <span>Export</span>
          </Button>
        </div>
        {subscriptions && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={subscriptions}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={subscriptionsHook}
            onRowSelectionChange={(row) => {
              setSelectedSubscriptionState(row)
            }}
            rowSelection={selectedSubscriptionState}
            getRowId={(row) => row.id.toString()}
            enableRowSelection
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
