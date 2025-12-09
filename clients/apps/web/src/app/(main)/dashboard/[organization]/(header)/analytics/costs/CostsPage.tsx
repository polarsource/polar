'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns'
import {
  BadgeDollarSignIcon,
  CircleUserRound,
  MousePointerClickIcon,
} from 'lucide-react'
import Link from 'next/link'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { CostsBandedSparkline } from './components/CostsBandedSparkline'
import { SpansHeader } from './components/SpansHeader'
import { SpansTitle } from './components/SpansTitle'
import {
  DEFAULT_INTERVAL,
  getCostsSearchParams,
  getDefaultEndDate,
  getDefaultStartDate,
} from './utils'

type TimeSeriesField = 'average' | 'p10' | 'p90' | 'p99'

interface ClientPageProps {
  organization: schemas['Organization']
}

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

export default function ClientPage({ organization }: ClientPageProps) {
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

  const { data: costData, isLoading } = useEventHierarchyStats(
    organization.id,
    {
      start_date: startDateISOString,
      end_date: endDateISOString,
      interval,
      aggregate_fields: ['_cost.amount'],
      sorting: ['-total'],
    },
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

  return (
    <DashboardBody
      title={<SpansTitle organization={organization} />}
      header={
        <SpansHeader
          dateRange={dateRange}
          interval={interval}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          onIntervalChange={onIntervalChange}
        />
      }
    >
      <div className="flex flex-col gap-y-6">
        {!isLoading && costData?.totals.length === 0 && (
          <p className="dark:text-polar-400 dark:bg-polar-800 flex items-center justify-center rounded-2xl bg-gray-50 p-12 text-center text-sm text-gray-500">
            No cost data available for the selected date range
          </p>
        )}
        {(costData?.totals ?? []).map((totals) => (
          <EventStatisticsCard
            key={totals.name}
            periods={costData?.periods || []}
            eventStatistics={totals}
            organization={organization}
            startDate={startDateISOString}
            endDate={endDateISOString}
            interval={interval}
          />
        ))}
      </div>
    </DashboardBody>
  )
}

function EventStatisticsCard({
  periods,
  eventStatistics,
  organization,
  startDate,
  endDate,
  interval,
}: {
  periods: schemas['StatisticsPeriod'][]
  eventStatistics: schemas['EventStatistics']
  organization: schemas['Organization']
  startDate: string
  endDate: string
  interval: string
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

  const searchString = getCostsSearchParams(startDate, endDate, interval)

  return (
    <Link
      href={`/dashboard/${organization.slug}/analytics/costs/${eventStatistics.event_type_id}${searchString ? `?${searchString}` : ''}`}
      className="dark:bg-polar-700 dark:hover:border-polar-600 dark:border-polar-700 @container flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-gray-100 p-4 transition-colors hover:border-gray-200 md:flex-row"
    >
      <div className="flex flex-col justify-between gap-1.5">
        <h2 className="text-lg/5 font-medium">
          {eventStatistics.label ?? eventStatistics.name}
        </h2>
        <dl className="dark:text-polar-500 flex max-w-sm items-center gap-5 font-mono text-gray-500">
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            <dt>
              <MousePointerClickIcon className="size-5" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.occurrences}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            <dt>
              <CircleUserRound className="size-5" strokeWidth={1.5} />
            </dt>
            <dd>{eventStatistics.customers}</dd>
          </div>
          <div className="flex flex-1 items-center justify-start gap-1.5 text-sm">
            {eventStatistics.totals?._cost_amount !== undefined && (
              <>
                <dt>
                  <BadgeDollarSignIcon className="size-5" strokeWidth={1.5} />
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
      <div className="dark:bg-polar-800 -m-2 flex max-w-80 flex-1 flex-col rounded-lg bg-gray-50 p-1">
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
