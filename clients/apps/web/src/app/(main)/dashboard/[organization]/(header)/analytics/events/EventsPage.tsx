'use client'

import { EventDetailPanel } from '@/components/Events/EventDetailPanel'
import { EventLog } from '@/components/Events/EventLog'
import { EventSearch } from '@/components/Events/EventSearch'
import { EventsHistogram } from '@/components/Events/EventsHistogram'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { useInViewport } from '@/hooks/utils'
import useDebounce from '@/utils/useDebounce'
import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search } from '@polar-sh/orbit/icons'
import { endOfToday } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect } from 'react'
import z from 'zod'
import { EventsSidebar } from './EventsSidebar'

const PAGE_SIZE = 100

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
  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(new Date(organization.created_at)),
  )
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(endOfToday()),
  )
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

  const router = useRouter()
  const searchParams = useSearchParams()

  const debouncedQuery = useDebounce(query, 500)
  const debouncedMetadata = useDebounce(metadata, 500)

  const {
    data: events,
    isFetching,
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

  const onDateRangeChange = (range: { from: Date; to: Date }) => {
    setStartDate(range.from)
    setEndDate(range.to)
  }

  const filterParams = new URLSearchParams(searchParams)
  filterParams.delete('event')
  const hasActiveFilters = filterParams.size > 0

  const items = events?.pages.flatMap((page) => page.items) ?? []
  const selectedIndex = items.findIndex((e) => e.id === selectedEventId)
  const previousEvent = selectedIndex > 0 ? items[selectedIndex - 1] : null
  const nextEvent = selectedIndex >= 0 ? items[selectedIndex + 1] : null

  const selectEvent = (id: string) => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setSelectedEventId(id)
    } else {
      router.push(`/dashboard/${organization.slug}/analytics/events/${id}`)
    }
  }

  return (
    <DashboardBody
      title={null}
      wrapperClassName="pt-4 md:gap-0 md:pt-6"
      contextViewPlacement="left"
      contextViewTitle="Filters"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={
        <EventsSidebar
          organization={organization}
          dateRange={{ from: startDate, to: endDate }}
          onDateRangeChange={onDateRangeChange}
          selectedEventTypes={selectedEventTypes ?? []}
          onToggleEventType={toggleEventType}
          selectedCustomerIds={selectedCustomerIds}
          onSelectCustomerIds={(ids) => {
            setSelectedCustomerIds(ids)
          }}
          metadata={metadata}
          onMetadataChange={(value) => {
            setMetadata(Object.keys(value).length > 0 ? value : null)
          }}
          hasActiveFilters={hasActiveFilters}
          onReset={() =>
            router.replace(`/dashboard/${organization.slug}/analytics/events`)
          }
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
      <Box flexDirection="column" gap="xl">
        <EventsHistogram
          organizationId={organization.id}
          startDate={startDate}
          endDate={endDate}
          eventNames={selectedEventTypes}
          customerIds={selectedCustomerIds}
          source={source}
          onSelectRange={onDateRangeChange}
        />
        <Box alignItems="center" gap="s">
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
            />
          </div>
          <div className="w-32 shrink-0">
            <Select
              value={sorting}
              onValueChange={(value) => {
                setSorting(value as '-timestamp' | 'timestamp')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-timestamp">Newest</SelectItem>
                <SelectItem value="timestamp">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Box>
        {items.length === 0 && !isFetching ? (
          <EmptyState
            icon={<Search />}
            title="No events found"
            description="Try widening the timeline or clearing filters"
          />
        ) : (
          <>
            <EventLog
              events={items}
              selectedEventId={selectedEventId}
              onSelect={selectEvent}
              onClose={() => setSelectedEventId(null)}
            />
            <div ref={loadMoreRef} />
            {isFetchingNextPage && (
              <Box justifyContent="center" paddingVertical="l">
                <Spinner />
              </Box>
            )}
          </>
        )}
      </Box>
    </DashboardBody>
  )
}

export default ClientPage
