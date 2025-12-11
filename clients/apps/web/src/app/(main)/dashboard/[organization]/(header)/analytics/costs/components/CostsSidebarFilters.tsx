'use client'

import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import {
  DEFAULT_INTERVAL,
  getDefaultEndDate,
  getDefaultStartDate,
} from '../utils'

import { CustomerSelector } from '@/components/Customer/CustomerSelector'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import {
  BadgeDollarSignIcon,
  CircleUserRound,
  MousePointerClickIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { getCostsSearchParams } from '../utils'
import { CostsBandedSparkline } from './CostsBandedSparkline'

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
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
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
        <div className="flex flex-col gap-y-2">
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
        </div>
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

type TimeSeriesField = 'average' | 'p10' | 'p90' | 'p99'
const getTimeSeriesValues = (
  periods: schemas['StatisticsPeriod'][],
  eventName: schemas['EventStatistics']['name'],
  field: TimeSeriesField,
): number[] => {
  return periods.map((period) => {
    const eventStats = period.stats.find((stat) => stat.name === eventName)
    if (!eventStats) return 0

    if (field === 'average') {
      return parseFloat(eventStats.averages?.['_cost_amount'] || '0')
    } else if (field === 'p10') {
      return parseFloat(eventStats.p10?.['_cost_amount'] || '0')
    } else if (field === 'p90') {
      return parseFloat(eventStats.p90?.['_cost_amount'] || '0')
    } else if (field === 'p99') {
      return parseFloat(eventStats.p99?.['_cost_amount'] || '0')
    }
    return 0
  })
}

function EventStatisticsCard({
  periods,
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
  const averageCostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'average')
  }, [periods, eventStatistics.name])

  const p10CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p10')
  }, [periods, eventStatistics.name])

  const p90CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p90')
  }, [periods, eventStatistics.name])

  const p99CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p99')
  }, [periods, eventStatistics.name])

  const searchString = getCostsSearchParams(
    startDate,
    endDate,
    interval,
    customerIds,
  )

  return (
    <Link
      href={
        isSelected
          ? `/dashboard/${organization.slug}/analytics/costs${searchString ? `?${searchString}` : ''}`
          : `/dashboard/${organization.slug}/analytics/costs/${eventStatistics.event_type_id}${searchString ? `?${searchString}` : ''}`
      }
      className={twMerge(
        'dark:bg-polar-700 flex cursor-pointer flex-col justify-between gap-5 rounded-2xl border px-3 pt-2 pb-3 transition-colors',
        isSelected
          ? 'border-gray-300 bg-gray-50'
          : 'dark:border-polar-700 dark:hover:border-polar-600 border-gray-200 hover:border-gray-300',
      )}
    >
      <div className="flex flex-col justify-between gap-1.5">
        <h2 className="text-sm font-medium">
          {eventStatistics.label ?? eventStatistics.name}
        </h2>
        <dl className="dark:text-polar-500 flex max-w-sm items-center gap-4 font-mono text-gray-500">
          <div className="flex flex-1 items-center justify-start gap-1.5 text-xs">
            <dt>
              <MousePointerClickIcon className="size-4" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.occurrences}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-xs">
            <dt>
              <CircleUserRound className="size-4" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.customers}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-xs">
            {eventStatistics.totals?._cost_amount !== undefined && (
              <>
                <dt>
                  <BadgeDollarSignIcon className="size-4" strokeWidth={1.5} />
                </dt>
                <dd>
                  {formatSubCentCurrency(
                    Number(eventStatistics.totals?._cost_amount),
                    'usd',
                  )}
                </dd>
              </>
            )}
          </div>
        </dl>
      </div>
      <div className="dark:bg-polar-800 -m-2 flex flex-1 flex-col rounded-xl bg-gray-50 p-1">
        <CostsBandedSparkline
          average={averageCostValues}
          p10={p10CostValues}
          p90={p90CostValues}
          p99={p99CostValues}
          trendUpIsBad={true}
          height={60}
          className="pointer-events-none"
        />
      </div>
    </Link>
  )
}
