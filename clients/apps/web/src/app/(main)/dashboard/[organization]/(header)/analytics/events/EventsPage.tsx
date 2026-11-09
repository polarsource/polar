'use client'

import { EventDetailPanel } from '@/components/Events/EventDetailPanel'
import { EventLog } from '@/components/Events/EventLog'
import { EventLogHeader } from '@/components/Events/EventLogRow'
import { EventLogSkeleton } from '@/components/Events/EventLogSkeleton'
import { EventSearch } from '@/components/Events/EventSearch'
import { EventsHistogram } from '@/components/Events/EventsHistogram'
import {
  formatTimeRange,
  isHourlyRange,
  TimeRange,
} from '@/components/Events/EventsHistogramControls'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import {
  DateRangeInterval,
  dateRangeIntervals,
} from '@/components/Metrics/DateRangePicker'
import {
  useEarliestEvent,
  useEvent,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { useInViewport } from '@/hooks/utils'
import { buildEventsFilter, formatEventCount } from '@/utils/event'
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
import { min, startOfDay } from 'date-fns'
import { useEffect, useState } from 'react'
import z from 'zod'
import { EventsSidebar } from './EventsSidebar'
import { DEFAULT_RANGE, recentRangeIntervals } from './rangePresets'

const PAGE_SIZE = 100

const PUSH_HISTORY = { history: 'push' } as const

const ClientPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral(['-timestamp', 'timestamp'] as const)
      .withDefault('-timestamp')
      .withOptions(PUSH_HISTORY),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)
  const [selectedEventTypes, setSelectedEventTypes] = useQueryState(
    'eventTypes',
    parseAsArrayOf(parseAsString).withOptions(PUSH_HISTORY),
  )
  const [costOnly, setCostOnly] = useQueryState(
    'costOnly',
    parseAsBoolean.withOptions(PUSH_HISTORY),
  )
  const [llmOnly, setLlmOnly] = useQueryState(
    'llmOnly',
    parseAsBoolean.withOptions(PUSH_HISTORY),
  )
  const eventsFilter = buildEventsFilter({
    costOnly: costOnly ?? false,
    llmOnly: llmOnly ?? false,
  })
  const [range, setRange] = useQueryState(
    'range',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const [customStartDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const [customEndDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const [selectionStart, setSelectionStart] = useQueryState(
    'selectionStart',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const [selectionEnd, setSelectionEnd] = useQueryState(
    'selectionEnd',
    parseAsIsoDateTime.withOptions(PUSH_HISTORY),
  )
  const setSelection = (selection: TimeRange | null) => {
    setSelectionStart(selection?.from ?? null)
    setSelectionEnd(selection?.to ?? null)
  }
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
  const selection =
    selectionStart !== null && selectionEnd !== null
      ? { from: selectionStart, to: selectionEnd }
      : null
  const isDefaultTimeRange =
    range === null && !isCustomRange && selection === null
  const listStartDate = selection?.from ?? startDate
  const listEndDate = selection?.to ?? endDate
  const [selectedCustomerIds, setSelectedCustomerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString).withOptions(PUSH_HISTORY),
  )
  const [metadata, setMetadata] = useQueryState(
    'metadata',
    parseAsJson(
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    ),
  )

  const [source, setSource] = useQueryState(
    'source',
    parseAsStringLiteral(['user', 'system'] as const).withOptions(PUSH_HISTORY),
  )
  const [selectedEventId, setSelectedEventId] = useQueryState(
    'event',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const stepToEvent = (id: string) =>
    setSelectedEventId(id, {
      history: selectedEventId === null ? 'push' : 'replace',
    })

  const debouncedQuery = useDebounce(query, 500)
  const debouncedMetadata = useDebounce(metadata, 500)
  const searchQuery =
    debouncedQuery && debouncedQuery.length >= 3 ? debouncedQuery : null

  const listFilters = {
    customer_id: selectedCustomerIds ?? null,
    source: source ?? null,
    filter: eventsFilter,
    start_timestamp: listStartDate.toISOString(),
    end_timestamp: listEndDate.toISOString(),
    query: searchQuery,
    metadata: debouncedMetadata ?? null,
  }

  const {
    data: events,
    isFetching,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteEvents(organization.id, {
    ...listFilters,
    name:
      selectedEventTypes && selectedEventTypes.length > 0
        ? selectedEventTypes
        : null,
    limit: PAGE_SIZE,
    sorting: [sorting],
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
    setSelection(null)
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

  const resetDateRange = () => {
    setRange(null)
    setStartDate(null)
    setEndDate(null)
    setRangeAnchor(new Date())
  }

  const onZoom = (dateRange: TimeRange, nextSelection: TimeRange | null) => {
    setRange(null)
    setStartDate(dateRange.from)
    setEndDate(dateRange.to)
    setSelection(nextSelection)
  }

  const hasActiveFilters =
    sorting !== '-timestamp' ||
    [
      query,
      selectedEventTypes,
      costOnly,
      llmOnly,
      range,
      customStartDate,
      customEndDate,
      selectionStart,
      selectionEnd,
      selectedCustomerIds,
      metadata,
      source,
    ].some((value) => value !== null)

  const resetFilters = () => {
    setSorting(null)
    setQuery(null)
    setSelectedEventTypes(null)
    setCostOnly(null)
    setLlmOnly(null)
    setRange(null)
    setStartDate(null)
    setEndDate(null)
    setSelection(null)
    setSelectedCustomerIds(null)
    setMetadata(null)
    setSource(null)
    setRangeAnchor(new Date())
  }

  const { data: earliestEvent } = useEarliestEvent(organization.id)
  const firstEventTimestamp = earliestEvent?.timestamp
  const earliest = startOfDay(
    min([
      new Date(organization.created_at),
      ...(firstEventTimestamp ? [new Date(firstEventTimestamp)] : []),
    ]),
  )

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
  const isSelectedInRange =
    selectedTime !== null &&
    selectedTime >= listStartDate.getTime() &&
    selectedTime <= listEndDate.getTime()
  const shouldLoadUntilSelected =
    selectedIndex < 0 &&
    isSelectedInRange &&
    isBeforeSelectedEvent &&
    hasNextPage

  useEffect(() => {
    if (shouldLoadUntilSelected && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [shouldLoadUntilSelected, isFetchingNextPage, fetchNextPage])

  return (
    <DashboardBody
      title={
        <Box
          flexGrow={1}
          alignItems="baseline"
          justifyContent="between"
          gap="s"
        >
          <Text as="h1" variant="heading-xxs">
            Events
          </Text>
          {totalCount !== null && (
            <Text variant="heading-xxs" color="muted" tabularNums>
              {formatEventCount(totalCount)}
            </Text>
          )}
        </Box>
      }
      wrapperClassName="gap-6 pt-4 md:pt-6"
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
          eventTypeFilters={listFilters}
          selectedEventTypes={selectedEventTypes ?? []}
          onToggleEventType={toggleEventType}
          costOnly={costOnly ?? false}
          onCostOnlyChange={(value) => setCostOnly(value || null)}
          llmOnly={llmOnly ?? false}
          onLlmOnlyChange={(value) => setLlmOnly(value || null)}
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
              previousEvent ? () => stepToEvent(previousEvent.id) : undefined
            }
            onNext={nextEvent ? () => stepToEvent(nextEvent.id) : undefined}
            onClose={() => setSelectedEventId(null)}
          />
        ) : undefined
      }
      wide
    >
      <Box flexDirection="column" gap="xl" flexGrow={1} minHeight={0}>
        <EventsHistogram
          organizationId={organization.id}
          startDate={startDate}
          endDate={endDate}
          eventNames={selectedEventTypes}
          customerIds={selectedCustomerIds}
          source={source}
          filter={eventsFilter}
          query={searchQuery}
          metadata={debouncedMetadata}
          selection={selection}
          onSelectionChange={setSelection}
          onZoom={onZoom}
          earliest={earliest}
          latest={rangeAnchor}
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
              timeRangeLabel={
                isDefaultTimeRange
                  ? null
                  : formatTimeRange(
                      selection ?? { from: startDate, to: endDate },
                      isHourlyRange(startDate, endDate),
                    )
              }
              onClearTimeRange={
                selection ? () => setSelection(null) : resetDateRange
              }
              timeRanges={[
                ...rangeIntervals,
                ...dateRangeIntervals(organization),
              ]}
              onTimeRangeChange={(interval) =>
                onDateRangeChange(
                  { from: interval.value[0], to: interval.value[1] },
                  interval,
                )
              }
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
                  onStep={stepToEvent}
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
