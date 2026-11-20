'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DateRange } from '@/components/Metrics/DateRangePicker'
import { useModal } from '@/components/Modal/useModal'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import {
  DEFAULT_SUBSCRIPTION_STATUS,
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import { SubscriptionsTable } from '@/components/Subscriptions/SubscriptionsTable'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import { useInfiniteSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import {
  DataTableSortingState,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { useDateRange } from '@/utils/date'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { functionalUpdate, OnChangeFn } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React from 'react'
import SubscriptionFilters from './SubscriptionFilters'

const PAGE_SIZE = 50

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  external_product_id: parseAsArrayOf(parseAsString),
  status: parseAsStringLiteral(subscriptionStatusFilterValues).withDefault(
    DEFAULT_SUBSCRIPTION_STATUS,
  ),
  cancel_at_period_end: parseAsBoolean,
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
  const router = useRouter()

  const { sorting, setSorting: setSortingState } = useDataTableQueryState({
    defaultSorting: [{ id: 'started_at', desc: true }],
    defaultPageSize: PAGE_SIZE,
  })

  const [
    {
      product_id: productId,
      external_product_id: externalProductId,
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
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

  const product: ProductFilter = {
    product_id: productId,
    external_product_id: externalProductId,
  }

  const onProductSelect = (value: ProductFilter) => {
    setFilters(value)
  }

  const onStatusSelect = (value: SubscriptionStatusFilter) => {
    setFilters({
      status: value,
      cancel_at_period_end: value === 'active' ? cancelAtPeriodEnd : null,
    })
  }

  const onCancelAtPeriodEndSelect = (value: boolean | null) => {
    setFilters({ cancel_at_period_end: value })
  }

  const onDateChange = (range: DateRange) => {
    setStartDate(range.from)
    setEndDate(range.to)
  }

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteSubscriptions(organization.id, {
      limit: PAGE_SIZE,
      sorting: sortingStateToQueryParam(sorting),
      product_id: productId ?? undefined,
      external_product_id: externalProductId ?? undefined,
      status: status === 'any' ? undefined : [status],
      cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
      started_after: startDate.toISOString(),
      started_before: endDate.toISOString(),
    })

  const subscriptions = data?.pages.flatMap((page) => page.items)
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const totalCount = data?.pages[0]?.pagination.total_count
  const countLabel =
    totalCount === undefined
      ? undefined
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'subscription' : 'subscriptions'}`

  return (
    <DashboardBody className="min-h-0 flex-1 pb-0" wide>
      <Box flexDirection="column" gap="xl" flexGrow={1} minHeight={0}>
        <SubscriptionFilters
          organization={organization}
          product={product}
          onProductSelect={onProductSelect}
          status={status}
          onStatusSelect={onStatusSelect}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          onCancelAtPeriodEndSelect={onCancelAtPeriodEndSelect}
          dateRange={{ from: startDate, to: endDate }}
          onDateChange={onDateChange}
          onExport={showExportModal}
        />
        <SubscriptionsTable
          subscriptions={subscriptions}
          sorting={sorting}
          onSortingChange={setSorting}
          onOpen={(id) =>
            router.push(
              `/dashboard/${organization.slug}/sales/subscriptions/${id}`,
            )
          }
          footerLabel={countLabel}
          isLoadingMore={isFetchingNextPage}
          onEndReached={loadMore}
        />
      </Box>
      <ExportSubscriptionsModal
        organization={organization}
        product={product}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </DashboardBody>
  )
}

export default ClientPage
