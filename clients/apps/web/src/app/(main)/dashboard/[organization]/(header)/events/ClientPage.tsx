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
  Search,
} from '@mui/icons-material'
import { operations, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  endOfMonth,
  endOfToday,
  endOfYesterday,
  startOfMonth,
  startOfToday,
  startOfYesterday,
  subMonths,
} from 'date-fns'
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

interface DatePresetDropdownProps {
  organization: schemas['Organization']
  setDateRange: (dateRange: { from: Date; to: Date }) => void
}

const DatePresetDropdown = ({
  organization,
  setDateRange,
}: DatePresetDropdownProps) => {
  const datePresets = {
    today: {
      from: startOfToday(),
      to: endOfToday(),
    },
    yesterday: {
      from: startOfYesterday(),
      to: endOfYesterday(),
    },
    this_month: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    last_month: {
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    },
    last_3_months: {
      from: subMonths(new Date(), 3),
      to: new Date(),
    },
    since_organization_creation: {
      from: new Date(organization.created_at),
      to: new Date(),
    },
  } as const

  const datePresetDisplayNames = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_month: 'This Month',
    last_month: 'Last Month',
    last_3_months: 'Last 3 Months',
    since_organization_creation: 'Since Organization Creation',
  } as const

  return (
    <Select
      defaultValue="since_organization_creation"
      onValueChange={(value) => {
        setDateRange(datePresets[value as keyof typeof datePresets])
      }}
    >
      <SelectTrigger className="w-fit min-w-64">
        <SelectValue placeholder="Date Range Preset" />
      </SelectTrigger>
      <SelectContent>
        {Object.keys(datePresets).map((key) => (
          <SelectItem key={key} value={key}>
            {datePresetDisplayNames[key as keyof typeof datePresetDisplayNames]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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
    parseAsIsoDateTime.withDefault(new Date()),
  )
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )

  const {
    isShown: isEventCreationGuideShown,
    show: showEventCreationGuide,
    hide: hideEventCreationGuide,
  } = useModal()

  const { data, fetchNextPage, hasNextPage } = useEventNames(organization.id, {
    query,
    sorting: [sorting],
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
          source: 'user',
        }
      : undefined
  }, [selectedEventName, currentPage, startDate, endDate])

  const { data: events } = useEvents(organization.id, eventParameters)

  const searchParams = useSearchParams()

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  const dateRange = useMemo(() => {
    return {
      from: startDate,
      to: endDate,
    }
  }, [startDate, endDate])

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
            <DatePresetDropdown
              organization={organization}
              setDateRange={onDateRangeChange}
            />
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
              <Events events={events?.items ?? []} />
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
