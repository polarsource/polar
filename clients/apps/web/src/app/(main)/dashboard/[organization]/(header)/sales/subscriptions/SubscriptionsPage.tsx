'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import ExportSubscriptionsModal from '@/components/Subscriptions/ExportSubscriptionsModal'
import { GanttLegend } from '@/components/Subscriptions/Gantt/GanttLegend'
import {
  DEFAULT_GANTT_GROUP,
  DEFAULT_GANTT_ZOOM,
  ganttGroupValues,
  ganttZoomValues,
} from '@/components/Subscriptions/Gantt/scale'
import { SubscriptionsGantt } from '@/components/Subscriptions/Gantt/SubscriptionsGantt'
import { SubscriptionDetailPanel } from '@/components/Subscriptions/SubscriptionDetailPanel'
import {
  DEFAULT_SUBSCRIPTION_STATUS,
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import { type ProductFilter } from '@/components/Subscriptions/SubscriptionsProductSelect'
import { useInfiniteSubscriptions } from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { sortingStateToQueryParam } from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import React, { useState } from 'react'
import { SubscriptionsAggregateView } from './SubscriptionsAggregateView'
import { SubscriptionsSidebar } from './SubscriptionsSidebar'

const PAGE_SIZE = 50
const DEFAULT_SORTING = [{ id: 'started_at', desc: true }]

const filterParsers = {
  product_id: parseAsString,
  external_product_id: parseAsString,
  status: parseAsStringLiteral(subscriptionStatusFilterValues).withDefault(
    DEFAULT_SUBSCRIPTION_STATUS,
  ),
  cancel_at_period_end: parseAsBoolean,
  zoom: parseAsStringLiteral(ganttZoomValues).withDefault(DEFAULT_GANTT_ZOOM),
  subscription: parseAsString,
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

  const onStatusSelect = (value: SubscriptionStatusFilter) => {
    setFilters({
      status: value,
      cancel_at_period_end: value === 'active' ? cancelAtPeriodEnd : null,
    })
  }

  const onCancelAtPeriodEndSelect = (value: boolean | null) => {
    setFilters({ cancel_at_period_end: value })
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
  const rowCount = data?.pages[0]?.pagination.total_count
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
        ? { product_id: groupKey, external_product_id: null }
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
      wrapperClassName="gap-4 pt-4 md:gap-0 md:pt-0"
      className="min-h-0 flex-1 md:pb-4"
      contextViewPlacement="left"
      contextViewTitle="Filters"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={
        <SubscriptionsSidebar
          organization={organization}
          count={rowCount}
          product={product}
          onProductSelect={onProductSelect}
          status={status}
          onStatusSelect={onStatusSelect}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          onCancelAtPeriodEndSelect={onCancelAtPeriodEndSelect}
          sorting={sorting}
          onSortingChange={setSorting}
          zoom={zoom}
          onZoomChange={(value) => setFilters({ zoom: value })}
          group={group}
          onGroupChange={(value) => setFilters({ group: value })}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
          onExport={showExportModal}
        />
      }
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
      <Box flexDirection="column" rowGap="l" flexGrow={1} minHeight={0}>
        {group !== 'customer' ? (
          <SubscriptionsAggregateView
            organization={organization}
            filters={listFilters}
            zoom={zoom}
            group={group}
            onSelect={drillDown}
          />
        ) : !subscriptions ? (
          <Box justifyContent="center" py="3xl">
            <Spinner />
          </Box>
        ) : subscriptions.length === 0 ? (
          <Box justifyContent="center" py="3xl">
            <Text color="muted">No subscriptions found</Text>
          </Box>
        ) : (
          <SubscriptionsGantt
            subscriptions={subscriptions}
            earliest={new Date(organization.created_at).getTime()}
            zoom={zoom}
            focus={focus}
            selectedId={selectedId}
            onSelect={select}
            isLoadingMore={isFetchingNextPage}
            onEndReached={loadMore}
          />
        )}
        <Box px="l">
          <GanttLegend aggregate={group !== 'customer'} />
        </Box>
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
