'use client'

import { EventCreationGuideModal } from '@/components/Events/EventCreationGuideModal'
import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import { useEventNames, useEvents } from '@/hooks/queries/events'
import AddOutlined from '@mui/icons-material/AddOutlined'
import Search from '@mui/icons-material/Search'
import { operations, schemas } from '@polar-sh/client'
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
import { endOfToday } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const PAGE_SIZE = 300

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
  const [selectedEventNames, setSelectedEventNames] = useQueryState(
    'eventNames',
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
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )

  const {
    isShown: isEventCreationGuideShown,
    show: showEventCreationGuide,
    hide: hideEventCreationGuide,
  } = useModal()

  const { data } = useEventNames(organization.id, {
    sorting: ['-occurrences'],
  })

  const eventNames = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const eventParameters = useMemo(():
    | operations['events:list']['parameters']['query']
    | undefined => {
    return {
      name:
        selectedEventNames && selectedEventNames.length > 0
          ? selectedEventNames
          : null,
      page: currentPage,
      limit: PAGE_SIZE,
      sorting: [sorting],
      start_timestamp: startDate.toISOString(),
      end_timestamp: endDate.toISOString(),
    }
  }, [selectedEventNames, currentPage, startDate, endDate, sorting])

  const { data: events } = useEvents(organization.id, eventParameters)

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
        console.log('hasScrolled')
      } else if (event.currentTarget.scrollTop === 0 && hasScrolled) {
        setHasScrolled(false)
        console.log('has not scrolled')
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
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <div>Events</div>
            <div className="flex flex-row items-center gap-4">
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
                disabled
              />
            </div>
            <div className="flex h-full grow flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Timeline</h3>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={onDateRangeChange}
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
              {eventNames.length > 0 && (
                <div className="flex flex-col gap-y-2">
                  <h3 className="text-sm">Event</h3>
                  <List size="small" className="rounded-xl">
                    {eventNames.map((eventName) => (
                      <ListItem
                        key={eventName.name}
                        size="small"
                        className="justify-between px-3 font-mono text-sm"
                        inactiveClassName="text-gray-500 dark:text-polar-500"
                        selected={selectedEventNames?.includes(eventName.name)}
                        onSelect={() =>
                          setSelectedEventNames((prev) =>
                            prev && prev.includes(eventName.name)
                              ? prev.filter((name) => name !== eventName.name)
                              : ([...(prev ?? []), eventName.name] as string[]),
                          )
                        }
                      >
                        <span className="w-full truncate">
                          {eventName.name}
                        </span>
                        <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                          {Number(eventName.occurrences).toLocaleString(
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
              )}
            </div>
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
      <div className="flex h-full flex-col gap-y-4">
        {events?.items.length === 0 ? (
          <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
            <h1 className="text-2xl font-normal">No Events Found</h1>
            <p className="dark:text-polar-500 text-gray-500">
              There are no events matching your current filters
            </p>
          </div>
        ) : (
          <>
            <Events events={events?.items ?? []} organization={organization} />
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
