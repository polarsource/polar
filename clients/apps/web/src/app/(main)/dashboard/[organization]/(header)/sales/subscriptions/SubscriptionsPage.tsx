'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CANCELLATION_REASONS } from '@/components/Metrics/cancellations/constants'
import { useModal } from '@/components/Modal/useModal'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import { SubscriptionDetailPanel } from '@/components/Subscriptions/SubscriptionDetailPanel'
import { SELECTABLE_STATUSES } from '@/components/Subscriptions/selectableStatuses'
import { SubscriptionsTable } from '@/components/Subscriptions/SubscriptionsTable'
import { useInfiniteSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import {
  DataTableSortingState,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Download } from '@polar-sh/orbit/icons'
import { functionalUpdate, OnChangeFn } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React from 'react'
import { SubscriptionsToolbar } from './SubscriptionsToolbar'
import { type ToolbarAction } from './ToolbarActionsMenu'

const PAGE_SIZE = 50

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  external_product_id: parseAsArrayOf(parseAsString),
  status: parseAsArrayOf(parseAsStringLiteral(SELECTABLE_STATUSES)),
  customer_id: parseAsArrayOf(parseAsString),
  discount_id: parseAsArrayOf(parseAsString),
  customer_cancellation_reason: parseAsArrayOf(
    parseAsStringLiteral(CANCELLATION_REASONS),
  ),
  cancel_at_period_end: parseAsBoolean,
  subscription: parseAsString,
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
      customer_id: customerId,
      discount_id: discountId,
      customer_cancellation_reason: cancellationReason,
      subscription: selectedId,
    },
    setFilters,
  ] = useQueryStates(filterParsers)

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

  const hasActiveFilters =
    productId !== null ||
    externalProductId !== null ||
    status !== null ||
    cancelAtPeriodEnd !== null ||
    customerId !== null ||
    discountId !== null ||
    cancellationReason !== null

  const resetFilters = () =>
    setFilters({
      product_id: null,
      external_product_id: null,
      status: null,
      cancel_at_period_end: null,
      customer_id: null,
      discount_id: null,
      customer_cancellation_reason: null,
    })

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteSubscriptions(organization.id, {
      limit: PAGE_SIZE,
      sorting: sortingStateToQueryParam(sorting),
      product_id: productId ?? undefined,
      external_product_id: externalProductId ?? undefined,
      status: status ?? undefined,
      cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
      customer_id: customerId ?? undefined,
      discount_id: discountId ?? undefined,
      customer_cancellation_reason: cancellationReason ?? undefined,
    })

  // Rows that tie on the sorted value have no fixed order between requests, so
  // one can come back on two pages.
  const subscriptions = data && [
    ...new Map(
      data.pages.flatMap((page) => page.items.map((item) => [item.id, item])),
    ).values(),
  ]
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }
  const selectedIndex =
    subscriptions?.findIndex(({ id }) => id === selectedId) ?? -1
  const selected = subscriptions?.[selectedIndex]
  const previous = subscriptions?.[selectedIndex - 1]
  const next = selected ? subscriptions?.[selectedIndex + 1] : undefined
  const select = (id: string | null) => setFilters({ subscription: id })

  const totalCount = data?.pages[0]?.pagination.total_count
  const countLabel =
    totalCount === undefined
      ? undefined
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'subscription' : 'subscriptions'}`

  const actions: ToolbarAction[][] = [
    [
      {
        key: 'export',
        label: 'Export CSV',
        icon: <Download />,
        onSelect: showExportModal,
      },
    ],
  ]

  return (
    <DashboardBody
      title={null}
      wrapperClassName="gap-0 pt-0"
      className="min-h-0 flex-1 pb-0"
      detailView={
        selected ? (
          <SubscriptionDetailPanel
            key={selected.id}
            subscription={selected}
            organization={organization}
            onPrevious={previous ? () => select(previous.id) : undefined}
            onNext={next ? () => select(next.id) : undefined}
            onClose={() => select(null)}
          />
        ) : undefined
      }
      wide
      flush
    >
      <SubscriptionsToolbar
        organization={organization}
        product={product}
        onProductSelect={setFilters}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        onStatusSelect={(value, cancel) =>
          setFilters({ status: value, cancel_at_period_end: cancel })
        }
        customerId={customerId}
        onCustomerSelect={(value) => setFilters({ customer_id: value })}
        discountId={discountId}
        onDiscountSelect={(value) => setFilters({ discount_id: value })}
        cancellationReason={cancellationReason}
        onCancellationReasonSelect={(value) =>
          setFilters({ customer_cancellation_reason: value })
        }
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        actions={actions}
      />
      <SubscriptionsTable
        subscriptions={subscriptions}
        sorting={sorting}
        onSortingChange={setSorting}
        selectedId={selectedId}
        onSelect={select}
        footerLabel={countLabel}
        isLoadingMore={isFetchingNextPage}
        onEndReached={loadMore}
      />
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
