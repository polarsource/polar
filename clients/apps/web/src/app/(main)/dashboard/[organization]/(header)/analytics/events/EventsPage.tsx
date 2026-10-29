'use client'

import { EventDetailPanel } from '@/components/Events/EventDetailPanel'
import { EventLog } from '@/components/Events/EventLog'
import { EventLogHeader } from '@/components/Events/EventLogRow'
import { EventLogSkeleton } from '@/components/Events/EventLogSkeleton'
import { EventSearch } from '@/components/Events/EventSearch'
import { EventsHistogram } from '@/components/Events/EventsHistogram'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import {
  DateRangeInterval,
  dateRangeIntervals,
} from '@/components/Metrics/DateRangePicker'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { useInViewport } from '@/hooks/utils'
import { COST_EVENTS_FILTER } from '@/utils/event'
import useDebounce from '@/utils/useDebounce'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search } from '@polar-sh/orbit/icons'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect, useState } from 'react'
import z from 'zod'
import { EventsSidebar } from './EventsSidebar'
import { DEFAULT_RANGE, recentRangeIntervals } from './rangePresets'

const PAGE_SIZE = 100

const formatEventCount = (count: number) =>
  new Intl.NumberFormat('en-US', {
    notation: count < 100_000 ? 'standard' : 'compact',
    maximumFractionDigits: 1,
  }).format(count)

const ClientPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral(['-timestamp', 'timestamp'] as const).withDefault(
      '-timestamp',
    ),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)
  const [selectedEventTypes, setSelectedEventTypes] = useQueryState(
    'eventTypes',
    parseAsArrayOf(parseAsString),
  )
  const [costOnly, setCostOnly] = useQueryState('costOnly', parseAsBoolean)
  const costFilter = costOnly ? COST_EVENTS_FILTER : null
  const [range, setRange] = useQueryState('range', parseAsString)
  const [customStartDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime,
  )
  const [customEndDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime,
  )
  const [rangeAnchor, setRangeAnchor] = useState(() => new Date())
  const rangeIntervals = recentRangeIntervals(rangeAnchor)
  const isCustomRange = customStartDate !== null && customEndDate !== null
  const selectedRange = isCustomRange ? null : (range ?? DEFAULT_RANGE)
  const preset =
    [...rangeIntervals, ...dateRangeIntervals(organization)].find(
      (interval) => interval.slug === selectedRange,
    ) ?? rangeIntervals[0]
  const startDate = isCustomRange ? customStartDate : preset.value[0]
  const endDate = isCustomRange ? customEndDate : preset.value[1]
  const [selectedCustomerIds, setSelectedCustomerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString),
  )
  const [metadata, setMetadata] = useQueryState(
    'metadata',
    parseAsJson(
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    ),
  )

  const [source, setSource] = useQueryState(
    'source',
    parseAsStringLiteral(['user', 'system'] as const),
  )
  const [selectedEventId, setSelectedEventId] = useQueryState(
    'event',
    parseAsString,
  )

  const debouncedQuery = useDebounce(query, 500)
  const debouncedMetadata = useDebounce(metadata, 500)

  const {
    data: events,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteEvents(organization.id, {
    name:
      selectedEventTypes && selectedEventTypes.length > 0
        ? selectedEventTypes
        : null,
    customer_id: selectedCustomerIds ?? null,
    source: source ?? null,
    filter: costFilter,
    limit: PAGE_SIZE,
    sorting: [sorting],
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    query: debouncedQuery && debouncedQuery.length >= 3 ? debouncedQuery : null,
    metadata: debouncedMetadata ?? null,
  })

  const { ref: loadMoreRef, inViewport } = useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage])

  const toggleEventType = (name: string) => {
    setSelectedEventTypes((prev) =>
      prev?.includes(name)
        ? prev.filter((n) => n !== name)
        : [...(prev ?? []), name],
    )
  }

  const onDateRangeChange = (
    dateRange: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => {
    if (interval) {
      setRange(interval.slug === DEFAULT_RANGE ? null : interval.slug)
      setStartDate(null)
      setEndDate(null)
      setRangeAnchor(new Date())
      return
    }
    setRange(null)
    setStartDate(dateRange.from)
    setEndDate(dateRange.to)
  }

  const hasActiveFilters =
    sorting !== '-timestamp' ||
    [
      query,
      selectedEventTypes,
      costOnly,
      range,
      customStartDate,
      customEndDate,
      selectedCustomerIds,
      metadata,
      source,
    ].some((value) => value !== null)

  const resetFilters = () => {
    setSorting(null)
    setQuery(null)
    setSelectedEventTypes(null)
    setCostOnly(null)
    setRange(null)
    setStartDate(null)
    setEndDate(null)
    setSelectedCustomerIds(null)
    setMetadata(null)
    setSource(null)
    setRangeAnchor(new Date())
  }

  const items = events?.pages.flatMap((page) => page.items) ?? []
  const firstPagination = events?.pages[0]?.pagination
  const totalCount =
    firstPagination && 'total_count' in firstPagination
      ? firstPagination.total_count
      : null
  const selectedIndex = items.findIndex((e) => e.id === selectedEventId)
  const previousEvent = selectedIndex > 0 ? items[selectedIndex - 1] : null
  const nextEvent = selectedIndex >= 0 ? items[selectedIndex + 1] : null

  const { data: selectedEvent } = useEvent(
    organization.id,
    selectedEventId ?? '',
  )
  const lastLoadedEvent = items.at(-1)
  const lastLoadedTime = lastLoadedEvent
    ? new Date(lastLoadedEvent.timestamp).getTime()
    : null
  const selectedTime = selectedEvent
    ? new Date(selectedEvent.timestamp).getTime()
    : null
  const isBeforeSelectedEvent =
    lastLoadedTime !== null &&
    selectedTime !== null &&
    (sorting === '-timestamp'
      ? lastLoadedTime >= selectedTime
      : lastLoadedTime <= selectedTime)
  const shouldLoadUntilSelected =
    selectedIndex < 0 && isBeforeSelectedEvent && hasNextPage

  useEffect(() => {
    if (shouldLoadUntilSelected && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [shouldLoadUntilSelected, isFetchingNextPage, fetchNextPage])

  return (
    <DashboardBody
      title={null}
      wrapperClassName="pt-4 md:gap-0 md:pt-6"
      className="min-h-0 flex-1 md:pb-0"
      contextViewPlacement="left"
      contextViewTitle="Filters"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={
        <EventsSidebar
          organization={organization}
          dateRange={{ from: startDate, to: endDate }}
          rangeIntervals={rangeIntervals}
          selectedRange={selectedRange}
          onDateRangeChange={onDateRangeChange}
          sorting={sorting}
          onSortingChange={setSorting}
          selectedEventTypes={selectedEventTypes ?? []}
          onToggleEventType={toggleEventType}
          costOnly={costOnly ?? false}
          onCostOnlyChange={(value) => setCostOnly(value || null)}
          source={source}
          onSourceChange={setSource}
          selectedCustomerIds={selectedCustomerIds}
          onSelectCustomerIds={(ids) => {
            setSelectedCustomerIds(ids)
          }}
          metadata={metadata}
          onMetadataChange={(value) => {
            setMetadata(Object.keys(value).length > 0 ? value : null)
          }}
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      }
      detailView={
        selectedEventId ? (
          <EventDetailPanel
            key={selectedEventId}
            eventId={selectedEventId}
            organization={organization}
            onSelectEvent={setSelectedEventId}
            onPrevious={
              previousEvent
                ? () => setSelectedEventId(previousEvent.id)
                : undefined
            }
            onNext={
              nextEvent ? () => setSelectedEventId(nextEvent.id) : undefined
            }
            onClose={() => setSelectedEventId(null)}
          />
        ) : undefined
      }
      wide
    >
      <Box flexDirection="column" gap="xl" flexGrow={1} minHeight={0}>
        <Box alignItems="baseline" justifyContent="between" gap="s">
          <Text as="h1" variant="heading-xxs">
            Events
          </Text>
          {totalCount !== null && (
            <Text variant="heading-xxs" color="muted" tabularNums>
              {formatEventCount(totalCount)}
            </Text>
          )}
        </Box>
        <EventsHistogram
          organizationId={organization.id}
          startDate={startDate}
          endDate={endDate}
          eventNames={selectedEventTypes}
          customerIds={selectedCustomerIds}
          source={source}
          filter={costFilter}
          onSelectRange={onDateRangeChange}
        />
        <Box alignItems="start" gap="s">
          <div className="min-w-0 flex-1">
            <EventSearch
              organizationId={organization.id}
              query={query}
              onQueryChange={(value) => {
                setQuery(value)
              }}
              selectedEventTypes={selectedEventTypes ?? []}
              onEventTypesChange={(names) => {
                setSelectedEventTypes(names && names.length > 0 ? names : null)
              }}
              selectedCustomerIds={selectedCustomerIds ?? []}
              onCustomerIdsChange={(ids) => {
                setSelectedCustomerIds(ids && ids.length > 0 ? ids : null)
              }}
              source={source}
              onSourceChange={(value) => {
                setSource(value)
              }}
              metadata={metadata ?? {}}
              onMetadataChange={(value) => {
                setMetadata(value)
              }}
              onOpenEvent={setSelectedEventId}
            />
          </div>
        </Box>
        {items.length === 0 && !isFetching ? (
          <EmptyState
            icon={<Search />}
            title="No events found"
            description="Try widening the timeline or clearing filters"
          />
        ) : (
          <Box flexDirection="column" flexGrow={1} minHeight={0}>
            <EventLogHeader />
            <Box
              flexDirection="column"
              flexGrow={1}
              minHeight={0}
              overflowY={{ base: 'visible', md: 'auto' }}
              paddingBottom={{ md: 'xl' }}
            >
              {isLoading ? (
                <EventLogSkeleton />
              ) : (
                <EventLog
                  events={items}
                  selectedEventId={selectedEventId}
                  onSelect={setSelectedEventId}
                  onClose={() => setSelectedEventId(null)}
                />
              )}
              <div ref={loadMoreRef} />
              {isFetchingNextPage && (
                <Box justifyContent="center" paddingVertical="l">
                  <Spinner />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

export default ClientPage
