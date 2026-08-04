'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DateRange } from '@/components/Metrics/DateRangePicker'
import { useModal } from '@/components/Modal/useModal'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import { SubscriptionStatus as SubscriptionStatusComponent } from '@/components/Subscriptions/SubscriptionStatus'
import {
  DEFAULT_SUBSCRIPTION_STATUS,
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import { useSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { DataTableSortingState, getAPIParams } from '@/utils/datatable'
import { useDateRange } from '@/utils/date'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Avatar } from '@polar-sh/orbit'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import {
  functionalUpdate,
  OnChangeFn,
  RowSelectionState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React, { useEffect, useState } from 'react'
import SubscriptionFilters from './SubscriptionFilters'

const filterParsers = {
  product_id: parseAsString,
  status: parseAsStringLiteral(subscriptionStatusFilterValues).withDefault(
    DEFAULT_SUBSCRIPTION_STATUS,
  ),
  cancel_at_period_end: parseAsBoolean,
  metadata: parseAsArrayOf(parseAsString),
}

// Secondary sort on ends_at when sorting by status
const withEndsAtSecondarySort = (
  sorting: DataTableSortingState,
): DataTableSortingState => {
  const statusSort = sorting.find((s) => s.id === 'status')
  if (!statusSort || sorting.some((s) => s.id === 'ends_at')) {
    return sorting
  }
  return [
    statusSort,
    { id: 'ends_at', desc: statusSort.desc },
    ...sorting.filter((s) => s.id !== 'status'),
  ]
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const [selectedSubscriptionState, setSelectedSubscriptionState] =
    useState<RowSelectionState>({})

  const router = useRouter()

  const {
    pagination,
    setPagination,
    sorting,
    setSorting: setSortingState,
    resetPage,
  } = useDataTableQueryState({
    defaultSorting: [{ id: 'started_at', desc: true }],
    defaultPageSize: 50,
  })

  const [
    {
      product_id: productId,
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      metadata,
    },
    setFilters,
  ] = useQueryStates(filterParsers)

  const { startDate, endDate, setStartDate, setEndDate } = useDateRange()

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()

  const setSorting: OnChangeFn<DataTableSortingState> = (updater) => {
    setSortingState((old) =>
      withEndsAtSecondarySort(functionalUpdate(updater, old)),
    )
  }

  const onProductSelect = (value: string | null) => {
    setFilters({ product_id: value })
    resetPage()
  }

  const onStatusSelect = (value: SubscriptionStatusFilter) => {
    setFilters({
      status: value,
      cancel_at_period_end: value === 'active' ? cancelAtPeriodEnd : null,
    })
    resetPage()
  }

  const onCancelAtPeriodEndSelect = (value: boolean | null) => {
    setFilters({ cancel_at_period_end: value })
    resetPage()
  }

  const onDateChange = (range: DateRange) => {
    setStartDate(range.from)
    setEndDate(range.to)
    resetPage()
  }

  const subscriptionsHook = useSubscriptions(organization.id, {
    ...getAPIParams(pagination, sorting),
    product_id: productId ?? undefined,
    status: status === 'any' ? undefined : [status],
    cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
    started_after: startDate.toISOString(),
    started_before: endDate.toISOString(),
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
        const showBillingName =
          !!customer.billing_name &&
          customer.name?.toLocaleLowerCase() !==
            customer.billing_name.toLocaleLowerCase()
        return (
          <div className="flex flex-row items-center gap-2 overflow-hidden">
            <Avatar
              avatar_url={customer.avatar_url}
              name={customer.email ?? customer.name ?? '—'}
            />
            <div className="overflow-hidden text-ellipsis">
              {customer.name || customer.email || '—'}
              {showBillingName && (
                <Box as="span" ml="s">
                  <Text as="span" color="muted">
                    {customer.billing_name}
                  </Text>
                </Box>
              )}
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
        <Text as="span" tabularNums>
          <FormattedDateTime datetime={props.getValue() as string} />
        </Text>
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
          <Text as="span" tabularNums>
            <FormattedDateTime datetime={datetime} />
          </Text>
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
      cell: ({ getValue }) => {
        const tier = getValue() as schemas['Product']
        return (
          <div className="flex flex-row items-center gap-2">
            {tier.name}
            {tier.is_archived && (
              <Status status="Archived" color="red" size="small" />
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
            <Text as="span" monospace>
              {props.getValue() as string}
            </Text>
          ),
        }))
      : []),
  ]

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <SubscriptionFilters
          organization={organization}
          productId={productId}
          onProductSelect={onProductSelect}
          status={status}
          onStatusSelect={onStatusSelect}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          onCancelAtPeriodEndSelect={onCancelAtPeriodEndSelect}
          dateRange={{ from: startDate, to: endDate }}
          onDateChange={onDateChange}
          onExport={showExportModal}
        />
        {subscriptions && pageCount !== undefined ? (
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
        ) : null}
      </div>
      <ExportSubscriptionsModal
        organization={organization}
        productId={productId}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </DashboardBody>
  )
}

export default ClientPage
