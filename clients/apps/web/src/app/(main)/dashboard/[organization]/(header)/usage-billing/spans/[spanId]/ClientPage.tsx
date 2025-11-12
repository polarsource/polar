'use client'

import { Events } from '@/components/Events/Events'
import { useEventDisplayName } from '@/components/Events/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { endOfToday, subMonths } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const PAGE_SIZE = 50

interface SpanDetailPageProps {
  organization: schemas['Organization']
  spanId: string
}

export default function SpanDetailPage({
  organization,
  spanId,
}: SpanDetailPageProps) {
  const router = useRouter()
  const [eventName] = useQueryState('eventName', parseAsString)

  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(subMonths(endOfToday(), 1)),
  )
  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(endOfToday()),
  )
  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as const).withDefault('day'),
  )

  const {
    data: eventsData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(
    organization.id,
    {
      name: eventName ? [eventName] : null,
      limit: PAGE_SIZE,
      sorting: ['-timestamp'],
      start_timestamp: startDate.toISOString(),
      end_timestamp: endDate.toISOString(),
    },
    !!eventName,
  )

  const { data: hierarchyStats } = useEventHierarchyStats(
    organization.id,
    startDate,
    endDate,
    interval,
    ['_cost.amount'],
    ['-occurrences'],
  )

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  const eventDisplayName = useEventDisplayName(eventName ?? '')

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      setInterval(newInterval)
    },
    [setInterval],
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

  if (!eventName) {
    return (
      <DashboardBody title="Span">
        <div className="flex flex-col gap-y-4">
          <p className="dark:text-polar-500 text-gray-500">
            No event name provided
          </p>
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody
      title="Span"
      className="flex flex-col gap-y-12"
      wide
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <div>Spans (Root events)</div>
          </div>
          <div
            className={twMerge(
              'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
              hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
            )}
            onScroll={handleScroll}
          >
            <div className="flex h-full grow flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Timeline</h3>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={onDateRangeChange}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Interval</h3>
                <IntervalPicker
                  interval={interval}
                  onChange={onIntervalChange}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
              <div className="dark:border-polar-700 -mx-4 border-t border-gray-200" />
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Events</h3>
                <List size="small" className="rounded-xl">
                  {hierarchyStats?.totals?.map((stat) => (
                    <ListItem
                      key={stat.name}
                      size="small"
                      className="justify-between px-3"
                      inactiveClassName="text-gray-500 dark:text-polar-500"
                      selected={eventName === stat.name}
                      onSelect={() => {
                        const params = new URLSearchParams()
                        params.set('eventName', stat.name)
                        if (startDate) {
                          params.set('startDate', startDate.toISOString())
                        }
                        if (endDate) {
                          params.set('endDate', endDate.toISOString())
                        }
                        params.set('interval', interval)
                        router.push(
                          `/dashboard/${organization.slug}/usage-billing/spans/${spanId}?${params}`,
                        )
                      }}
                    >
                      <span className="truncate">{stat.name}</span>
                      <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                        {Number(stat.occurrences).toLocaleString('en-US', {
                          style: 'decimal',
                          compactDisplay: 'short',
                          notation: 'compact',
                        })}
                      </span>
                    </ListItem>
                  ))}
                </List>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-y-4">
        <h3 className="text-4xl">{eventDisplayName}</h3>
      </div>
      {events.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row justify-between">
            <h3 className="text-2xl">Spans</h3>
            <h3 className="dark:text-polar-500 text-2xl text-gray-400">
              {events.length}
              {hasNextPage ? '+' : ''} {events.length === 1 ? 'Span' : 'Spans'}
            </h3>
          </div>
          <div className="flex flex-col gap-y-3">
            <Events events={events} organization={organization} />
            {hasNextPage && (
              <Button
                className="self-start"
                variant="secondary"
                onClick={() => fetchNextPage()}
                loading={isFetching}
              >
                Load More
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
          <h1 className="text-2xl font-normal">No Events Found</h1>
          <p className="dark:text-polar-500 text-gray-500">
            There are no events matching this span
          </p>
        </div>
      )}
    </DashboardBody>
  )
}
