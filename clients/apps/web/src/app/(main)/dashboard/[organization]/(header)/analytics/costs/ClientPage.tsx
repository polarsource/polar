'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Sparkline } from '@/components/Sparkline/Sparkline'
import { useEventHierarchyStats } from '@/hooks/queries/events'
// import { parseSearchParams, serializeSearchParams } from '@/utils/datatable'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfToday, subMonths } from 'date-fns'
import {
  BadgeDollarSignIcon,
  CircleUserRound,
  MousePointerClickIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { SpansHeader } from './SpansHeader'
import { SpansTitle } from './SpansTitle'

type TimeSeriesField = 'average' | 'p95' | 'p99'

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
    } else if (field === 'p95') {
      return parseFloat(eventStats.p95?.['_cost_amount'] || '0')
    } else if (field === 'p99') {
      return parseFloat(eventStats.p99?.['_cost_amount'] || '0')
    }
    return 0
  })
}

export default function ClientPage({ organization }: ClientPageProps) {
  const router = useRouter()

  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(toISODate(subMonths(endOfToday(), 1))),
  )
  const [endDateISOString, setEndDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(toISODate(endOfToday())),
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
    ] as const).withDefault('day'),
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
      wide
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
}: {
  periods: schemas['StatisticsPeriod'][]
  eventStatistics: schemas['EventStatistics']
  organization: schemas['Organization']
}) {
  const averageCostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'average')
  }, [periods, eventStatistics.name])

  const p95CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p95')
  }, [periods, eventStatistics.name])

  const p99CostValues = useMemo(() => {
    return getTimeSeriesValues(periods, eventStatistics.name, 'p99')
  }, [periods, eventStatistics.name])

  return (
    <Link
      href={`/dashboard/${organization.slug}/analytics/costs/${eventStatistics.event_type_id}`}
      className="dark:bg-polar-700 dark:hover:border-polar-600 dark:border-polar-700 @container flex cursor-pointer flex-col gap-4 rounded-2xl border border-gray-100 p-4 transition-colors hover:border-gray-200"
    >
      <div className="flex flex-col justify-between gap-3 @xl:flex-row">
        <h2 className="text-lg font-medium">{eventStatistics.name}</h2>
        <dl className="dark:text-polar-500 flex max-w-sm flex-1 items-center gap-5 font-mono text-gray-500">
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
      <div className="flex flex-col gap-5 @3xl:flex-row">
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>Average cost</h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.averages?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={averageCostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>
              95<sup>th</sup> percentile{' '}
              <span className="hidden sm:inline @3xl:hidden @5xl:inline">
                cost
              </span>
            </h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.p95?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={p95CostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
        <div className="dark:bg-polar-800 flex-1 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="dark:text-polar-300 flex justify-between gap-3 p-1 text-gray-700">
            <h3>
              99<sup>th</sup> percentile{' '}
              <span className="hidden sm:inline @3xl:hidden @5xl:inline">
                cost
              </span>
            </h3>
            <span className="font-mono">
              {formatSubCentCurrency(
                Number(eventStatistics.p99?._cost_amount),
                'usd',
              )}
            </span>
          </div>
          <div>
            <Sparkline
              values={p99CostValues}
              trendUpIsBad={true}
              className="pointer-events-none"
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
