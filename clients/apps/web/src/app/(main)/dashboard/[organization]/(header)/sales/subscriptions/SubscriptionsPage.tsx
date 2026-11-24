'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CANCELLATION_REASONS } from '@/components/Metrics/cancellations/constants'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { type ProductFilter } from '@/components/Products/ProductSelect'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import {
  DEFAULT_GANTT_GROUP,
  DEFAULT_PIXELS_PER_DAY,
  ganttGroupValues,
  MAX_PIXELS_PER_DAY,
  type GanttGroup,
} from '@/components/Subscriptions/Gantt/scale'
import { SubscriptionDetailPanel } from '@/components/Subscriptions/SubscriptionDetailPanel'
import { SELECTABLE_STATUSES } from '@/components/Subscriptions/selectableStatuses'
import { SubscriptionsTable } from '@/components/Subscriptions/SubscriptionsTable'
import { useSafeCopy } from '@/hooks/clipboard'
import { uniqueSubscriptions, useInfiniteSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import {
  DataTableSortingState,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Copy, Download } from '@polar-sh/orbit/icons'
import { functionalUpdate, OnChangeFn } from '@tanstack/react-table'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import useDebounce from '@/utils/useDebounce'
import React from 'react'
import { SubscriptionsTimeline } from './SubscriptionsTimeline'
import { SubscriptionsToolbar } from './SubscriptionsToolbar'
import { type ToolbarAction } from '@/components/Shared/Toolbar/ToolbarActionsMenu'
import { useSelectedSubscription } from './useSelectedSubscription'
import {
  subscriptionViewValues,
  useSubscriptionsView,
  type SubscriptionView,
} from './useSubscriptionsView'
import { useTimelineControls } from './useTimelineControls'

const PAGE_SIZE = 50
const DEFAULT_SORTING = [{ id: 'started_at', desc: true }]

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
  started_after: parseAsIsoDateTime,
  started_before: parseAsIsoDateTime,
  query: parseAsString,
  subscription: parseAsString,
  zoom: parseAsFloat.withDefault(DEFAULT_PIXELS_PER_DAY),
  view: parseAsStringLiteral(subscriptionViewValues),
  group:
    parseAsStringLiteral(ganttGroupValues).withDefault(DEFAULT_GANTT_GROUP),
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
    defaultSorting: DEFAULT_SORTING,
    defaultPageSize: PAGE_SIZE,
  })

  const [
    {
      product_id: productId,
      external_product_id: externalProductId,
      status,
      cancel_at_period_end: cancelAtPeriodEndParam,
      customer_id: customerId,
      discount_id: discountId,
      customer_cancellation_reason: cancellationReason,
      started_after: startedAfter,
      started_before: startedBefore,
      query,
      subscription: selectedId,
      zoom: zoomParam,
      view: linkedView,
      group,
    },
    setFilters,
  ] = useQueryStates(filterParsers)
  const debouncedQuery = useDebounce(query, 300)

  // Only "set to end" is offered as a filter. Older links can carry false,
  // which no control shows, so it is left out.
  const cancelAtPeriodEnd = cancelAtPeriodEndParam ? true : null
  // Half a range filters nothing.
  const started =
    startedAfter && startedBefore
      ? { from: startedAfter, to: startedBefore }
      : null

  const [view, selectView] = useSubscriptionsView(
    organization.id,
    linkedView,
    () => setFilters({ view: null }),
  )
  const isTimeline = view === 'timeline'
  // A link can carry any number. Only a usable zoom is passed on.
  const zoom =
    zoomParam > 0
      ? Math.min(zoomParam, MAX_PIXELS_PER_DAY)
      : DEFAULT_PIXELS_PER_DAY
  const timeline = useTimelineControls((value) => setFilters({ zoom: value }))

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

  // On the timeline the group and the sort are menu options, so they reset
  // with the filters.
  const [sort] = sorting
  const hasActiveFilters =
    productId !== null ||
    externalProductId !== null ||
    status !== null ||
    cancelAtPeriodEnd !== null ||
    customerId !== null ||
    discountId !== null ||
    cancellationReason !== null ||
    started !== null ||
    (isTimeline &&
      (group !== DEFAULT_GANTT_GROUP ||
        sort?.id !== DEFAULT_SORTING[0].id ||
        sort.desc !== DEFAULT_SORTING[0].desc))

  const resetFilters = () => {
    setFilters({
      product_id: null,
      external_product_id: null,
      status: null,
      cancel_at_period_end: null,
      customer_id: null,
      discount_id: null,
      customer_cancellation_reason: null,
      started_after: null,
      started_before: null,
    })
    if (isTimeline) {
      setFilters({ group: null })
      setSortingState(DEFAULT_SORTING)
      timeline.setFocus(undefined)
    }
  }

  const listFilters = {
    product_id: productId ?? undefined,
    external_product_id: externalProductId ?? undefined,
    status: status ?? undefined,
    cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
    customer_id: customerId ?? undefined,
    discount_id: discountId ?? undefined,
    customer_cancellation_reason: cancellationReason ?? undefined,
    started_after: started?.from.toISOString(),
    started_before: started?.to.toISOString(),
    query: debouncedQuery?.trim() || undefined,
  }
  const {
    data,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteSubscriptions(organization.id, {
    ...listFilters,
    limit: PAGE_SIZE,
    sorting: sortingStateToQueryParam(sorting),
  })

  const subscriptions = data && uniqueSubscriptions(data.pages)
  // Not while the first page for new filters is loading, and not again after a
  // page failed, or the visible end of the list would retry it without pause.
  const loadMore = () => {
    if (hasNextPage && !isFetching && !isFetchNextPageError) {
      fetchNextPage()
    }
  }
  const { selected, previous, next } = useSelectedSubscription(
    organization.id,
    subscriptions,
    selectedId,
  )
  const select = (id: string | null) => setFilters({ subscription: id })

  const totalCount = data?.pages[0]?.pagination.total_count
  const countLabel =
    totalCount === undefined
      ? undefined
      : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'subscription' : 'subscriptions'}`

  const safeCopy = useSafeCopy(toast)
  // The view is not in the address unless a link put it there, so it is added.
  const copyLink = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    await safeCopy(url.toString())
    toast({ title: 'Link copied' })
  }
  const actions: ToolbarAction[][] = [
    [
      {
        key: 'export',
        label: 'Export CSV',
        icon: <Download />,
        onSelect: showExportModal,
      },
      {
        key: 'copy-link',
        label: 'Copy link to this view',
        icon: <Copy />,
        onSelect: copyLink,
      },
    ],
    isTimeline ? timeline.actions : [],
  ]
  // The picked time only applies to the list that opening a group leads to.
  const changeView = (value: SubscriptionView) => {
    timeline.setFocus(undefined)
    selectView(value)
  }
  const changeGroup = (value: GanttGroup) => {
    timeline.setFocus(undefined)
    setFilters({ group: value })
  }
  // Opening a group lists its subscriptions, at the time that was picked.
  const drillDown = ({
    groupKey,
    start,
  }: {
    groupKey: string
    start?: number
  }) => {
    setFilters({
      group: 'customer',
      ...(group === 'product'
        ? { product_id: [groupKey], external_product_id: null }
        : {}),
    })
    if (start !== undefined) {
      setSortingState([{ id: 'current_period_end', desc: false }])
    }
    timeline.setFocus(start)
  }

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
        started={started}
        onStartedSelect={(value) =>
          setFilters({
            started_after: value?.from ?? null,
            started_before: value?.to ?? null,
          })
        }
        query={query}
        onQuerySelect={(value) => setFilters({ query: value })}
        sorting={sorting}
        onSortingChange={setSortingState}
        view={view}
        onViewChange={changeView}
        group={group}
        onGroupChange={changeGroup}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        actions={actions}
      />
      {isTimeline ? (
        <SubscriptionsTimeline
          organization={organization}
          group={group}
          subscriptions={subscriptions}
          filters={listFilters}
          zoom={zoom}
          zoomRef={timeline.zoomRef}
          onZoomChange={timeline.onZoomChange}
          focus={timeline.focus}
          footerLabel={countLabel}
          selectedId={selectedId}
          onSelect={select}
          isLoadingMore={isFetchingNextPage}
          onEndReached={loadMore}
          onDrillDown={drillDown}
        />
      ) : (
        <SubscriptionsTable
          organization={organization}
          subscriptions={subscriptions}
          sorting={sorting}
          onSortingChange={setSorting}
          selectedId={selectedId}
          onSelect={select}
          footerLabel={countLabel}
          isLoadingMore={isFetchingNextPage}
          onEndReached={loadMore}
        />
      )}
      <ExportSubscriptionsModal
        organization={organization}
        product={product}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        customerId={customerId}
        discountId={discountId}
        cancellationReason={cancellationReason}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </DashboardBody>
  )
}

export default ClientPage
