'use client'

import {
  DEFAULT_INTERVAL,
  getCostsSearchParams,
  getDefaultEndDate,
  getDefaultStartDate,
} from '@/app/(main)/dashboard/[organization]/(header)/analytics/costs/utils'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfDay, subMonths } from 'date-fns'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo, useState } from 'react'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { useEventHierarchyStats } from '@/hooks/queries/events'

import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useParams, useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

export default function CostsSidebarFilters({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const params = useParams()

  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )

  const [endDateISOString, setEndDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(getDefaultEndDate()),
  )

  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString
      ? endOfDay(fromISODate(endDateISOString))
      : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as const).withDefault(DEFAULT_INTERVAL),
  )

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onDateRangeChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDateISOString(toISODate(dateRange.from))
      setEndDateISOString(toISODate(dateRange.to))
    },
    [setStartDateISOString, setEndDateISOString],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      setInterval(newInterval)
    },
    [setInterval],
  )

  const [customerIds, setCustomerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString).withDefault([]),
  )

  const { data: costData } = useEventHierarchyStats(organization.id, {
    start_date: startDateISOString,
    end_date: endDateISOString,
    interval,
    aggregate_fields: ['_cost.amount'],
    sorting: ['-total'],
  })

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

  return (
    <div
      className={twMerge(
        'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
        hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
      )}
      onScroll={handleScroll}
    >
      <div className="flex flex-col items-stretch gap-y-2">
        <h3 className="text-sm">Timeline</h3>
        <DateRangePicker
          date={dateRange}
          onDateChange={onDateRangeChange}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm">Grouping</h3>
        <IntervalPicker
          interval={interval}
          onChange={onIntervalChange}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm">Events</h3>
        <List className="rounded-lg">
          {(costData?.totals ?? []).map((totals) => (
            <EventStatisticsCard
              key={totals.name}
              periods={costData?.periods || []}
              eventStatistics={totals}
              organization={organization}
              startDate={startDateISOString}
              endDate={endDateISOString}
              interval={interval}
              customerIds={customerIds}
              isSelected={totals.event_type_id === params.spanId}
            />
          ))}
        </List>
      </div>
      <div className="flex flex-col gap-y-2">
        <CustomerSelector
          organizationId={organization.id}
          selectedCustomerIds={customerIds}
          onSelectCustomerIds={setCustomerIds}
        />
      </div>
    </div>
  )
}

function EventStatisticsCard({
  eventStatistics,
  organization,
  startDate,
  endDate,
  interval,
  customerIds,
  isSelected = false,
}: {
  periods: schemas['StatisticsPeriod'][]
  eventStatistics: schemas['EventStatistics']
  organization: schemas['Organization']
  startDate: string
  endDate: string
  interval: string
  customerIds?: string[]
  isSelected?: boolean
}) {
  const searchString = getCostsSearchParams(
    startDate,
    endDate,
    interval,
    customerIds,
  )

  const router = useRouter()

  const onSelect = () => {
    router.push(
      `/dashboard/${organization.slug}/analytics/costs/${eventStatistics.event_type_id}${searchString ? `?${searchString}` : ''}`,
    )
  }

  return (
    <ListItem size="small" selected={isSelected} onSelect={onSelect}>
      <div className="flex flex-col justify-between gap-1.5">
        <h2 className="text-sm font-medium">
          {eventStatistics.label ?? eventStatistics.name}
        </h2>
        <div className="dark:text-polar-500 flex max-w-sm items-center gap-4 font-mono text-gray-500">
          <div className="flex flex-1 items-center justify-start gap-1.5 text-xs">
            <span>
              {Intl.NumberFormat('en-US').format(eventStatistics.occurrences)}
            </span>
            <span>
              {eventStatistics.occurrences === 1 ? 'Event' : 'Events'}
            </span>
          </div>
        </div>
      </div>
    </ListItem>
  )
}
