'use client'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import { EventCreationGuideModal } from '@/components/Events/EventCreationGuideModal'
import { EventMetadataFilter } from '@/components/Events/EventMetadataFilter'
import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useEventNames, useInfiniteEvents } from '@/hooks/queries/events'
import useDebounce from '@/utils/useDebounce'
import AddOutlined from '@mui/icons-material/AddOutlined'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { endOfToday } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import z from 'zod'

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
  const [metadata, setMetadata] = useQueryState(
    'metadata',
    parseAsJson(
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    ),
  )

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

  const debouncedQuery = useDebounce(query, 500)
  const debouncedMetadata = useDebounce(metadata, 500)

  const eventParameters = useMemo(() => {
    return {
      name:
        selectedEventTypes && selectedEventTypes.length > 0
          ? selectedEventTypes
          : null,
      customer_id: selectedCustomerIds ?? null,
      limit: PAGE_SIZE,
      sorting: [sorting] as ['-timestamp' | 'timestamp'],
      start_timestamp: startDate.toISOString(),
      end_timestamp: endDate.toISOString(),
      query: debouncedQuery ?? null,
      metadata: debouncedMetadata ?? null,
      cursor_pagination: true as const,
    }
  }, [
    selectedEventTypes,
    startDate,
    endDate,
    sorting,
    debouncedQuery,
    selectedCustomerIds,
    debouncedMetadata,
  ])

  const {
    data: eventsData,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, eventParameters)

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

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

  return (
    <DashboardBody
      title="Events"
      header={
        <h3 className="dark:text-polar-500 text-xl text-gray-500">
          {events.length > 0 && (
            <>
              {events.length}
              {hasNextPage && '+'} Events
            </>
          )}
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

              {Object.entries(eventTypes ?? {})
                .sort((a) => (a[0] === 'system' ? 1 : -1))
                .map(([source, eventTypes]) => {
                  if (eventTypes.length === 0) return null

                  return (
                    <div className="flex flex-col gap-y-2" key={source}>
                      <h3 className="text-sm capitalize">{source} Events</h3>
                      <List size="small" className="rounded-xl">
                        {eventTypes.map((eventType) => (
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
                                  ? prev.filter(
                                      (name) => name !== eventType.name,
                                    )
                                  : ([
                                      ...(prev ?? []),
                                      eventType.name,
                                    ] as string[]),
                              )
                            }
                          >
                            <span className="w-full truncate">
                              {eventType.label}
                            </span>
                            <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                              {Number(eventType.occurrences).toLocaleString(
                                'en-US',
                                {
                                  style: 'decimal',
                                  compactDisplay: 'short',
                                  notation: 'compact',
                                },
                              )}
                            </span>
                          </ListItem>
                        ))}
                      </List>
                    </div>
                  )
                })}
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
        {events.length === 0 ? (
          <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
            <h1 className="text-2xl font-normal">No Events Found</h1>
            <p className="dark:text-polar-500 text-gray-500">
              There are no events matching your current filters
            </p>
          </div>
        ) : (
          <>
            <Events events={events} organization={organization} />
            <div className="dark:border-polar-700 flex justify-center rounded-xl border border-gray-200">
              {hasNextPage ? (
                <button
                  className="group dark:text-polar-500 dark:hover:bg-polar-700 dark:hover:text-polar-300 relative flex h-10 w-full cursor-pointer items-center justify-center gap-x-2 rounded-xl py-3 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                  onClick={() => fetchNextPage()}
                >
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 transition-all duration-200 group-hover:opacity-0 group-hover:blur-[2px]">
                    Showing {events.length} events
                  </span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 blur-[2px] transition-all duration-200 group-hover:opacity-100 group-hover:blur-none">
                    Show more
                  </span>
                </button>
              ) : (
                <span className="dark:text-polar-500/60 dark:bg-polar-800 flex h-10 w-full items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
                  Showing all {events.length} events
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
