'use client'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import { EventCreationGuideModal } from '@/components/Events/EventCreationGuideModal'
import { EventMetadataFilter } from '@/components/Events/EventMetadataFilter'
import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import {
  useEventHierarchyStats,
  useEventNames,
  useEvents,
} from '@/hooks/queries/events'
import { api } from '@/utils/client'
import { formatSubCentCurrency } from '@/utils/formatters'
import { getTimestampFormatter, toISODate } from '@/utils/metrics'
import useDebounce from '@/utils/useDebounce'
import AddOutlined from '@mui/icons-material/AddOutlined'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import Search from '@mui/icons-material/Search'
import { operations, schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { useQueries } from '@tanstack/react-query'
import { endOfToday, format } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import z from 'zod'
import { Chart } from '../costs/components/Chart/Chart'

const LOCAL_STORAGE_KEY = 'polar:events:filter-state'

type EventSourceType = 'user' | 'system'

interface FilterState {
  expandedSources: Record<string, boolean>
  eventSource: EventSourceType
}

const getDefaultFilterState = (): FilterState => ({
  expandedSources: {
    user: true,
    system: true,
  },
  eventSource: 'user', // User events selected by default
})

const loadFilterState = (): FilterState => {
  if (typeof window === 'undefined') return getDefaultFilterState()
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parsing errors
  }
  return getDefaultFilterState()
}

const saveFilterState = (state: FilterState) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

const PAGE_SIZE = 100

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
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
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )
  const [metadata, setMetadata] = useQueryState(
    'metadata',
    parseAsJson(
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    ),
  )

  // Filter state with local storage persistence - load from localStorage on init
  const [filterState, setFilterState] = useState<FilterState>(() =>
    loadFilterState(),
  )

  const setEventSource = useCallback((source: EventSourceType) => {
    setFilterState((prev) => {
      const newState = {
        ...prev,
        eventSource: source,
      }
      saveFilterState(newState)
      return newState
    })
  }, [])

  const router = useRouter()

  const {
    isShown: isEventCreationGuideShown,
    show: showEventCreationGuide,
    hide: hideEventCreationGuide,
  } = useModal()

  const { data } = useEventNames(organization.id, {
    sorting: ['name'],
    limit: 500,
  })

  const eventTypes = useMemo(
    () =>
      data?.pages
        .flatMap((page) => page.items)
        .reduce(
          (acc, curr) => {
            acc[curr.source] = [...(acc[curr.source] ?? []), curr]
            return acc
          },
          {} as Record<schemas['EventSource'], schemas['EventTypeWithStats'][]>,
        ),
    [data],
  )

  // Get all event names for fetching sparkline data
  const allEventNames = useMemo(() => {
    if (!eventTypes) return []
    return Object.values(eventTypes)
      .flat()
      .map((et) => et.name)
  }, [eventTypes])

  // Create a map from event name to event type ID
  const eventNameToIdMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!eventTypes) return map
    Object.values(eventTypes)
      .flat()
      .forEach((et) => {
        map.set(et.name, et.id)
      })
    return map
  }, [eventTypes])

  // Get all selected event type IDs for the chart queries
  const selectedEventTypeIds = useMemo(() => {
    if (!selectedEventTypes || selectedEventTypes.length === 0) return []
    return selectedEventTypes
      .map((name) => ({ name, id: eventNameToIdMap.get(name) }))
      .filter((item): item is { name: string; id: string } => !!item.id)
  }, [selectedEventTypes, eventNameToIdMap])

  // Fetch hierarchy stats for all events to get sparkline data
  const { data: allEventsStats } = useEventHierarchyStats(
    organization.id,
    {
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      interval: 'day',
      // @ts-expect-error - event_name filter is valid but not in generated types
      event_name: allEventNames.length > 0 ? allEventNames : undefined,
    },
    allEventNames.length > 0,
  )

  // Create a map from event name to sparkline values (occurrences over time)
  const eventSparklineMap = useMemo(() => {
    const map = new Map<string, number[]>()
    if (!allEventsStats?.periods) return map

    // For each event, extract its occurrences across all periods
    const eventNames = new Set<string>()
    allEventsStats.periods.forEach((period) => {
      period.stats.forEach((stat) => {
        eventNames.add(stat.name)
      })
    })

    eventNames.forEach((eventName) => {
      const values = allEventsStats.periods.map((period) => {
        const stat = period.stats.find((s) => s.name === eventName)
        return stat?.occurrences || 0
      })
      map.set(eventName, values)
    })

    return map
  }, [allEventsStats])

  // Create a map from event name to total occurrences (for the selected date range)
  const eventOccurrencesMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!allEventsStats?.totals) return map

    allEventsStats.totals.forEach((stat) => {
      map.set(stat.name, stat.occurrences || 0)
    })

    return map
  }, [allEventsStats])

  const debouncedQuery = useDebounce(query, 500)
  const debouncedMetadata = useDebounce(metadata, 500)

  const eventParameters = useMemo(():
    | operations['events:list']['parameters']['query']
    | undefined => {
    return {
      name:
        selectedEventTypes && selectedEventTypes.length > 0
          ? selectedEventTypes
          : null,
      source: filterState.eventSource,
      page: currentPage,
      customer_id: selectedCustomerIds ?? null,
      limit: PAGE_SIZE,
      sorting: [sorting],
      start_timestamp: startDate.toISOString(),
      end_timestamp: endDate.toISOString(),
      query: debouncedQuery ?? null,
      metadata: debouncedMetadata ?? null,
      // @ts-expect-error - aggregate_fields populates cost metadata on events
      aggregate_fields: ['_cost.amount'],
    }
  }, [
    filterState.eventSource,
    selectedEventTypes,
    currentPage,
    startDate,
    endDate,
    sorting,
    debouncedQuery,
    selectedCustomerIds,
    debouncedMetadata,
  ])

  const { data: events } = useEvents(organization.id, eventParameters)

  // Fetch hierarchy stats for each selected event type
  // We make separate queries because event_type_id only accepts a single ID
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hierarchyStatsQueries = useQueries({
    queries: selectedEventTypeIds.map(({ name, id }) => ({
      queryKey: [
        'eventHierarchyStats',
        organization.id,
        {
          timezone,
          start_date: toISODate(startDate),
          end_date: toISODate(endDate),
          interval: 'day',
          aggregate_fields: ['_cost.amount'],
          event_type_id: id,
        },
      ],
      queryFn: () =>
        unwrap(
          api.GET('/v1/events/statistics/timeseries', {
            params: {
              query: {
                organization_id: organization.id,
                timezone: timezone as 'UTC',
                start_date: toISODate(startDate),
                end_date: toISODate(endDate),
                interval: 'day',
                aggregate_fields: ['_cost.amount'],
                event_type_id: id,
              },
            },
          }),
        ),
      enabled: !!id,
      meta: { eventName: name },
    })),
  })

  const isHierarchyLoading = hierarchyStatsQueries.some((q) => q.isLoading)
  const hasFilters = selectedEventTypeIds.length > 0

  // Calculate chart data from all hierarchy stats queries
  const chartData = useMemo(() => {
    if (!selectedEventTypes || selectedEventTypes.length === 0) return []

    // Get all successful query results with their event names
    const queryResults = hierarchyStatsQueries
      .map((query, index) => ({
        data: query.data,
        eventName: selectedEventTypeIds[index]?.name,
      }))
      .filter(
        (r): r is { data: NonNullable<typeof r.data>; eventName: string } =>
          !!r.data && !!r.eventName,
      )

    if (queryResults.length === 0) return []

    // Use the first query's periods as the base timeline
    const basePeriods = queryResults[0]?.data?.periods || []
    if (basePeriods.length === 0) return []

    return basePeriods
      .map((period, periodIndex) => {
        const result: Record<string, unknown> = {
          date: format(new Date(period.timestamp), 'MMM d, yyyy'),
          timestamp: new Date(period.timestamp),
        }

        // Add data from each query result
        queryResults.forEach(({ data, eventName }) => {
          const stat = data.periods[periodIndex]?.stats[0]
          const sanitizedName = eventName.replace(/\./g, '_')
          result[`${sanitizedName}_occurrences`] = stat?.occurrences || 0
          result[`${sanitizedName}_cost`] = parseFloat(
            stat?.averages?.['_cost_amount'] || '0',
          )
        })

        return result
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [hierarchyStatsQueries, selectedEventTypes, selectedEventTypeIds])

  // Generate series for charts based on all selected event types
  const occurrencesSeries = useMemo(() => {
    if (!selectedEventTypes || selectedEventTypes.length === 0) return []
    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
    ]
    return selectedEventTypes.map((name, index) => ({
      key: `${name.replace(/\./g, '_')}_occurrences`,
      label: name,
      color: colors[index % colors.length],
    }))
  }, [selectedEventTypes])

  const costSeries = useMemo(() => {
    if (!selectedEventTypes || selectedEventTypes.length === 0) return []
    const colors = [
      '#10b981',
      '#3b82f6',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
    ]
    return selectedEventTypes.map((name, index) => ({
      key: `${name.replace(/\./g, '_')}_cost`,
      label: name,
      color: colors[index % colors.length],
    }))
  }, [selectedEventTypes])

  // Calculate total cost metrics for the header (combine all selected event types)
  const costMetrics = useMemo(() => {
    const queryResults = hierarchyStatsQueries
      .map((query) => query.data)
      .filter((data): data is NonNullable<typeof data> => !!data)

    if (queryResults.length === 0) {
      return { totalOccurrences: 0, totalCost: 0 }
    }

    return queryResults.reduce(
      (acc, data) => {
        const stat = data.totals?.[0]
        return {
          totalOccurrences: acc.totalOccurrences + (stat?.occurrences || 0),
          totalCost:
            acc.totalCost + parseFloat(stat?.totals?.['_cost_amount'] || '0'),
        }
      },
      { totalOccurrences: 0, totalCost: 0 },
    )
  }, [hierarchyStatsQueries])

  const timestampFormatter = useMemo(() => getTimestampFormatter('day'), [])

  const searchParams = useSearchParams()

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  const [hasScrolled, setHasScrolled] = useState(false)

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (event.currentTarget.scrollTop > 0 && !hasScrolled) {
        setHasScrolled(true)
      } else if (event.currentTarget.scrollTop === 0 && hasScrolled) {
        setHasScrolled(false)
      }
    },
    [hasScrolled],
  )

  const dateRange = {
    from: startDate,
    to: endDate,
  }

  // Build the page title with selected event names
  const pageTitle = useMemo(() => {
    if (!selectedEventTypes || selectedEventTypes.length === 0) {
      return 'Events'
    }
    if (selectedEventTypes.length === 1) {
      return `Events: ${selectedEventTypes[0]}`
    }
    return `Events: ${selectedEventTypes.length} selected`
  }, [selectedEventTypes])

  return (
    <DashboardBody
      title={pageTitle}
      header={
        <h3 className="dark:text-polar-500 text-xl text-gray-500">
          {events?.pagination.total_count}{' '}
          {events?.pagination.total_count === 1 ? 'Event' : 'Events'}
        </h3>
      }
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <div>Events</div>
            <div className="flex flex-row items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-6 w-6 rounded-full"
                    variant="ghost"
                    onClick={() => {
                      router.replace(
                        `/dashboard/${organization.slug}/analytics/events`,
                      )
                    }}
                  >
                    <RefreshOutlined fontSize="inherit" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>Reset Filters</span>
                </TooltipContent>
              </Tooltip>
              <Button
                size="icon"
                className="h-6 w-6"
                onClick={showEventCreationGuide}
              >
                <AddOutlined fontSize="small" />
              </Button>
            </div>
          </div>
          <div
            className={twMerge(
              'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
              hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
            )}
            onScroll={handleScroll}
          >
            <div className="flex flex-row items-center gap-3">
              <Input
                placeholder="Search Events"
                value={query ?? undefined}
                onChange={(e) => setQuery(e.target.value)}
                preSlot={<Search fontSize="small" />}
              />
            </div>
            <div className="flex h-full grow flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Timeline</h3>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={onDateRangeChange}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Sorting</h3>
                <Select
                  value={sorting}
                  onValueChange={(value) =>
                    setSorting(value as '-timestamp' | 'timestamp')
                  }
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

              {/* Events List */}
              {(() => {
                const eventTypeList =
                  eventTypes?.[filterState.eventSource] ?? []
                if (eventTypeList.length === 0) return null

                return (
                  <List size="small" className="rounded-xl">
                    {eventTypeList.map((eventType) => {
                      const sparklineValues =
                        eventSparklineMap.get(eventType.name) || []
                      const occurrences =
                        eventOccurrencesMap.get(eventType.name) ??
                        eventType.occurrences

                      return (
                        <ListItem
                          key={eventType.name}
                          size="small"
                          className="justify-between px-3 font-mono text-xs"
                          inactiveClassName="text-gray-500 dark:text-polar-500"
                          selected={selectedEventTypes?.includes(
                            eventType.name,
                          )}
                          onSelect={() =>
                            setSelectedEventTypes((prev) =>
                              prev && prev.includes(eventType.name)
                                ? prev.filter((name) => name !== eventType.name)
                                : ([
                                    ...(prev ?? []),
                                    eventType.name,
                                  ] as string[]),
                            )
                          }
                        >
                          <span className="max-w-[120px] truncate">
                            {eventType.label}
                          </span>
                          <div className="flex flex-row items-center gap-x-2">
                            {sparklineValues.length > 1 && (
                              <Sparkline
                                values={sparklineValues}
                                width={40}
                                height={16}
                                className="opacity-60"
                              />
                            )}
                            <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                              {Number(occurrences).toLocaleString('en-US', {
                                style: 'decimal',
                                compactDisplay: 'short',
                                notation: 'compact',
                              })}
                            </span>
                          </div>
                        </ListItem>
                      )
                    })}
                  </List>
                )
              })()}

              <CustomerSelector
                organizationId={organization.id}
                selectedCustomerIds={selectedCustomerIds}
                onSelectCustomerIds={setSelectedCustomerIds}
              />

              <EventMetadataFilter
                metadata={Object.entries(metadata ?? {}).map(
                  ([key, value]) => ({
                    key,
                    value,
                  }),
                )}
                onChange={(metadata) => {
                  setMetadata(
                    metadata.reduce(
                      (acc, curr) => {
                        acc[curr.key] = curr.value
                        return acc
                      },
                      {} as Record<string, string | number | boolean>,
                    ),
                  )
                }}
              />
            </div>
          </div>
          <Modal
            title="Create Event"
            isShown={isEventCreationGuideShown}
            hide={hideEventCreationGuide}
            modalContent={
              <EventCreationGuideModal hide={hideEventCreationGuide} />
            }
          />
        </div>
      }
      wide
    >
      <div className="flex h-full flex-col gap-y-4">
        {/* Event Source Toggle */}
        <Tabs
          value={filterState.eventSource}
          onValueChange={(value) => setEventSource(value as EventSourceType)}
        >
          <TabsList>
            <TabsTrigger value="user">User Events</TabsTrigger>
            <TabsTrigger value="system">System Events</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Charts section - shown when filters are applied */}
        {hasFilters && chartData.length > 0 && (
          <div className="mb-4 flex flex-col gap-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="col-span-1">
                <div className="dark:bg-polar-700 rounded-3xl bg-gray-50 p-2">
                  <div className="flex flex-row items-center justify-between px-3 pt-2 pb-4">
                    <h3 className="text-lg font-medium">Occurrences</h3>
                    <span className="tabular-nums">
                      {costMetrics.totalOccurrences.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <Chart
                      data={chartData}
                      series={occurrencesSeries}
                      xAxisKey="timestamp"
                      height={200}
                      xAxisFormatter={(value) =>
                        value instanceof Date
                          ? timestampFormatter(value)
                          : String(value)
                      }
                      labelFormatter={(value) =>
                        value instanceof Date
                          ? value.toLocaleDateString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                            })
                          : String(value)
                      }
                      showYAxis={true}
                      yAxisFormatter={(value) => value.toLocaleString()}
                      loading={isHierarchyLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="dark:bg-polar-700 rounded-3xl bg-gray-50 p-2">
                  <div className="flex flex-row items-center justify-between px-3 pt-2 pb-4">
                    <h3 className="text-lg font-medium">Costs</h3>
                    <span className="tabular-nums">
                      {formatSubCentCurrency(costMetrics.totalCost, 'usd')}
                    </span>
                  </div>
                  <div>
                    <Chart
                      data={chartData}
                      series={costSeries}
                      xAxisKey="timestamp"
                      height={200}
                      xAxisFormatter={(value) =>
                        value instanceof Date
                          ? timestampFormatter(value)
                          : String(value)
                      }
                      labelFormatter={(value) =>
                        value instanceof Date
                          ? value.toLocaleDateString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                            })
                          : String(value)
                      }
                      showYAxis={true}
                      yAxisFormatter={(value) =>
                        formatSubCentCurrency(value, 'usd')
                      }
                      loading={isHierarchyLoading}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {events?.items.length === 0 ? (
          <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
            <h1 className="text-2xl font-normal">No Events Found</h1>
            <p className="dark:text-polar-500 text-gray-500">
              There are no events matching your current filters
            </p>
          </div>
        ) : (
          <>
            <Events
              events={events?.items ?? []}
              organization={organization}
              showSourceBadge={false}
            />
            <Pagination
              className="self-end"
              totalCount={events?.pagination.total_count ?? 0}
              pageSize={PAGE_SIZE}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              currentURL={searchParams}
            />
          </>
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
