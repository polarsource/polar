'use client'

import { EventCreationGuideModal } from '@/components/Events/EventCreationGuideModal'
import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import Spinner from '@/components/Shared/Spinner'
import { useEventNames, useEvents } from '@/hooks/queries/events'
import { useInViewport } from '@/hooks/utils'

import {
  AddOutlined,
  ArrowDownward,
  ArrowUpward,
  CheckOutlined,
  FilterList,
  Search,
} from '@mui/icons-material'
import { operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { endOfToday } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import {
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import React, { useCallback, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const PAGE_SIZE = 50

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      'last_seen',
      '-last_seen',
      'occurrences',
      '-occurrences',
    ] as const).withDefault('-last_seen'),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)
  const [selectedEventName, setSelectedEventName] = useQueryState(
    'eventName',
    parseAsString,
  )
  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(new Date(organization.created_at)),
  )
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(endOfToday()),
  )
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )
  const [source, setSource] = useQueryState(
    'source',
    parseAsStringLiteral(['user', 'system', 'all'] as const).withDefault(
      'user',
    ),
  )

  const {
    isShown: isEventCreationGuideShown,
    show: showEventCreationGuide,
    hide: hideEventCreationGuide,
  } = useModal()

  const { data, fetchNextPage, hasNextPage } = useEventNames(organization.id, {
    query,
    sorting: [sorting],
    source: source === 'all' ? undefined : source,
  })

  const eventNames = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const eventParameters = useMemo(():
    | operations['events:list']['parameters']['query']
    | undefined => {
    return selectedEventName
      ? {
          name: [selectedEventName],
          page: currentPage,
          limit: PAGE_SIZE,
          start_timestamp: startDate.toISOString(),
          end_timestamp: endDate.toISOString(),
          source: source === 'all' ? undefined : source,
        }
      : undefined
  }, [selectedEventName, currentPage, startDate, endDate, source])

  const { data: events } = useEvents(organization.id, eventParameters)

  const searchParams = useSearchParams()

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  const dateRange = {
    from: startDate,
    to: endDate,
  }

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  return (
    <DashboardBody
      title={selectedEventName ? selectedEventName : 'Events'}
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
          <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
            <div>Events</div>
            <div className="flex flex-row items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" className="h-6 w-6" variant="ghost">
                    <FilterList fontSize="small" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSource('all')}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        source !== 'all' && 'invisible',
                      )}
                    />
                    <span>All</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSource('user')}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        source !== 'user' && 'invisible',
                      )}
                    />
                    <span>User</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSource('system')}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        source !== 'system' && 'invisible',
                      )}
                    />
                    <span>System</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  setSorting(
                    sorting === '-last_seen' ? 'last_seen' : '-last_seen',
                  )
                }
              >
                {sorting === 'last_seen' ? (
                  <ArrowUpward fontSize="small" />
                ) : (
                  <ArrowDownward fontSize="small" />
                )}
              </Button>
              <Button
                size="icon"
                className="h-6 w-6"
                onClick={showEventCreationGuide}
              >
                <AddOutlined fontSize="small" />
              </Button>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 px-4 py-2">
            <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Search
                fontSize="inherit"
                className="dark:text-polar-500 text-gray-500"
              />
            </div>
            <Input
              className="w-full rounded-none border-none bg-transparent p-0 !shadow-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              placeholder="Search Events"
              value={query ?? undefined}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="dark:divide-polar-800 flex h-full flex-grow flex-col divide-y divide-gray-50 overflow-y-auto">
            {eventNames.map((eventName) => (
              <div
                key={eventName.name}
                onClick={() => setSelectedEventName(eventName.name)}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedEventName === eventName.name &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <div>{eventName.name}</div>
                    <div className="dark:text-polar-500 text-sm text-gray-500">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                      }).format(eventName.occurrences)}{' '}
                      Ingested Events
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {hasNextPage && (
              <div
                ref={loadingRef}
                className="flex w-full items-center justify-center py-8"
              >
                <Spinner />
              </div>
            )}
          </div>
          <Modal
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
      {selectedEventName ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row items-center gap-4">
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateRangeChange}
            />
          </div>

          {events?.items.length === 0 ? (
            <div className="rounded-4xl dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 border border-gray-200 p-24">
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
      ) : (
        <div className="mt-96 flex w-full flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-normal">No Event Entity Selected</h1>
          <p className="dark:text-polar-500 text-gray-500">
            Select an event entity to view its details
          </p>
        </div>
      )}
    </DashboardBody>
  )
}

export default ClientPage
