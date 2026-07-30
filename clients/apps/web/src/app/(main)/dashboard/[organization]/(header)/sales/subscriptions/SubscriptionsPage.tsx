'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import SubscriptionCancellationSelect from '@/components/Subscriptions/SubscriptionCancellationSelect'
import { SubscriptionStatus as SubscriptionStatusComponent } from '@/components/Subscriptions/SubscriptionStatus'
import SubscriptionStatusSelect, {
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import { useProducts, useSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { getServerURL } from '@/utils/api'
import { DataTableSortingState, getAPIParams } from '@/utils/datatable'
import { useDateRange } from '@/utils/date'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
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
import { startOfDay } from 'date-fns'

const filterParsers = {
  product_id: parseAsString,
  status: parseAsStringLiteral(subscriptionStatusFilterValues).withDefault(
    'active',
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

  const subscriptionTiers = useProducts(organization.id, {
    is_recurring: true,
    limit: 100,
  })

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

  const onExport = () => {
    const url = new URL(
      `${getServerURL()}/v1/subscriptions/export?organization_id=${organization.id}`,
    )

    window.open(url, '_blank')
  }

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-row items-center justify-between gap-2 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-4">
            <div className="w-auto">
              <SubscriptionStatusSelect
                value={status}
                onChange={onStatusSelect}
              />
            </div>
            {status === 'active' && (
              <div className="w-auto">
                <SubscriptionCancellationSelect
                  value={cancelAtPeriodEnd}
                  onChange={onCancelAtPeriodEndSelect}
                />
              </div>
            )}
            <div className="w-auto">
              <SubscriptionTiersSelect
                products={subscriptionTiers.data?.items || []}
                value={productId}
                onChange={onProductSelect}
              />
            </div>
            <DateRangePicker
              date={{ from: startDate, to: endDate }}
              onDateChange={onDateChange}
              className="[&>button:last-child]:text-left"
              minDate={startOfDay(new Date(organization.created_at))}
            />
          </div>
          <Button
            onClick={onExport}
            className="flex shrink-0 flex-row items-center"
            variant={'secondary'}
            wrapperClassNames="gap-x-2"
          >
            <FileDownloadOutlined fontSize="inherit" />
            <span>Export</span>
          </Button>
        </div>
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
    </DashboardBody>
  )
}

export default ClientPage
