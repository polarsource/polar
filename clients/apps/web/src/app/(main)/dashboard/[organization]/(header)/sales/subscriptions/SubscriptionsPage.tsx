'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import { GanttLegend } from '@/components/Subscriptions/Gantt/GanttLegend'
import {
  GanttZoomSlider,
  type GanttZoomSliderHandle,
} from '@/components/Subscriptions/Gantt/GanttZoomSlider'
import {
  DEFAULT_GANTT_GROUP,
  DEFAULT_PIXELS_PER_DAY,
  type GanttZoomHandle,
  ganttGroupValues,
} from '@/components/Subscriptions/Gantt/scale'
import { SubscriptionsTable } from '@/components/Subscriptions/SubscriptionsTable'
import { SubscriptionDetailPanel } from '@/components/Subscriptions/SubscriptionDetailPanel'
import {
  DEFAULT_SUBSCRIPTION_STATUS,
  subscriptionStatusFilterValues,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import { type ProductFilter } from '@/components/Subscriptions/SubscriptionsProductSelect'
import { useInfiniteSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { useDebouncedCallback } from '@/hooks/utils'
import { sortingStateToQueryParam } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import dynamic from 'next/dynamic'
import React, { useCallback, useRef, useState } from 'react'
import {
  SubscriptionsToolbar,
  subscriptionViewValues,
} from './SubscriptionsToolbar'

// The timeline is laid out from the current time and the local timezone, so
// it cannot be rendered on the server without a hydration mismatch.
const ChartPlaceholder = () => <Box flexGrow={1} />

const SubscriptionsGantt = dynamic(
  () =>
    import('@/components/Subscriptions/Gantt/SubscriptionsGantt').then(
      (module) => module.SubscriptionsGantt,
    ),
  { ssr: false, loading: ChartPlaceholder },
)

const SubscriptionsAggregateView = dynamic(
  () =>
    import('./SubscriptionsAggregateView').then(
      (module) => module.SubscriptionsAggregateView,
    ),
  { ssr: false, loading: ChartPlaceholder },
)

const PAGE_SIZE = 50
const ZOOM_COMMIT_DELAY = 150
const DEFAULT_SORTING = [{ id: 'started_at', desc: true }]

const filterParsers = {
  product_id: parseAsArrayOf(parseAsString),
  external_product_id: parseAsArrayOf(parseAsString),
  status: parseAsStringLiteral(subscriptionStatusFilterValues).withDefault(
    DEFAULT_SUBSCRIPTION_STATUS,
  ),
  cancel_at_period_end: parseAsBoolean,
  zoom: parseAsFloat.withDefault(DEFAULT_PIXELS_PER_DAY),
  subscription: parseAsString,
  view: parseAsStringLiteral(subscriptionViewValues).withDefault('timeline'),
  group:
    parseAsStringLiteral(ganttGroupValues).withDefault(DEFAULT_GANTT_GROUP),
}

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const { sorting, setSorting } = useDataTableQueryState({
    defaultSorting: DEFAULT_SORTING,
    defaultPageSize: PAGE_SIZE,
  })

  const [
    {
      product_id: productId,
      external_product_id: externalProductId,
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      zoom,
      subscription: selectedId,
      view,
      group,
    },
    setFilters,
  ] = useQueryStates(filterParsers)

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()

  const product: ProductFilter = {
    product_id: productId,
    external_product_id: externalProductId,
  }

  const onProductSelect = (value: ProductFilter) => {
    setFilters(value)
  }

  const [sort] = sorting
  const hasActiveFilters =
    productId !== null ||
    externalProductId !== null ||
    status !== DEFAULT_SUBSCRIPTION_STATUS ||
    cancelAtPeriodEnd !== null ||
    sort?.id !== DEFAULT_SORTING[0].id ||
    sort.desc !== DEFAULT_SORTING[0].desc

  const resetFilters = () => {
    setFilters({
      product_id: null,
      external_product_id: null,
      status: null,
      cancel_at_period_end: null,
    })
    setSorting(DEFAULT_SORTING)
  }

  const listFilters = {
    product_id: productId ?? undefined,
    external_product_id: externalProductId ?? undefined,
    status: status === 'any' ? undefined : [status],
    cancel_at_period_end: cancelAtPeriodEnd ?? undefined,
  }
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteSubscriptions(organization.id, {
      ...listFilters,
      limit: PAGE_SIZE,
      sorting: sortingStateToQueryParam(sorting),
    })

  const subscriptions = data?.pages.flatMap((page) => page.items)
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

  const [focus, setFocus] = useState<number>()
  // Dragging the zoom moves the chart directly. The URL and the render that
  // follows from it only catch up once the drag pauses.
  const zoomRef = useRef<GanttZoomHandle>(null)
  const commitSpan = useDebouncedCallback(
    (value: number) => setFilters({ zoom: Math.round(value * 100) / 100 }),
    ZOOM_COMMIT_DELAY,
  )
  const sliderRef = useRef<GanttZoomSliderHandle>(null)
  // Stable, because the chart subscribes to it from an effect.
  const onPinch = useCallback(
    (value: number) => {
      sliderRef.current?.show(value)
      commitSpan(value)
    },
    [commitSpan],
  )
  const onZoom = (value: number) => {
    zoomRef.current?.zoomTo(value)
    commitSpan(value)
  }
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
      setSorting([{ id: 'current_period_end', desc: false }])
    }
    setFocus(start)
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
        onProductSelect={onProductSelect}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        onStatusSelect={(value, cancel) =>
          setFilters({ status: value, cancel_at_period_end: cancel })
        }
        sorting={sorting}
        onSortingChange={setSorting}
        view={view}
        onViewChange={(value) => setFilters({ view: value })}
        group={group}
        onGroupChange={(value) => setFilters({ group: value })}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        onExport={showExportModal}
      />
      {view === 'table' ? (
        <SubscriptionsTable
          subscriptions={subscriptions}
          selectedId={selectedId}
          onSelect={select}
          isLoadingMore={isFetchingNextPage}
          onEndReached={loadMore}
        />
      ) : (
        <Box flexDirection="column" flexGrow={1} minHeight={0}>
          {group !== 'customer' ? (
            <SubscriptionsAggregateView
              organization={organization}
              filters={listFilters}
              zoom={zoom}
              zoomRef={zoomRef}
              onZoomChange={onPinch}
              group={group}
              onSelect={drillDown}
            />
          ) : (
            <SubscriptionsGantt
              subscriptions={subscriptions}
              earliest={new Date(organization.created_at).getTime()}
              zoom={zoom}
              zoomRef={zoomRef}
              onZoomChange={onPinch}
              focus={focus}
              selectedId={selectedId}
              onSelect={select}
              isLoadingMore={isFetchingNextPage}
              onEndReached={loadMore}
            />
          )}
          <Box
            px="l"
            py="m"
            alignItems="center"
            gap="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <GanttZoomSlider ref={sliderRef} zoom={zoom} onChange={onZoom} />

            <GanttLegend aggregate={group !== 'customer'} />
          </Box>
        </Box>
      )}
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
