'use client'

import { useEventTypes } from '@/hooks/queries/event_types'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns'
import {
  BadgeDollarSignIcon,
  CircleUserRound,
  MousePointerClickIcon,
} from 'lucide-react'
import Link from 'next/link'
import { parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import CostsEventsTable from './[spanId]/CostsEventsTable'
import { CostsBandedSparkline } from './components/CostsBandedSparkline'
import {
  getCostsSearchParams,
  getDefaultEndDate,
  getDefaultStartDate,
} from './utils'

interface ClientPageProps {
  organization: schemas['Organization']
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

export default function ClientPage({ organization }: ClientPageProps) {
  const [startDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )
  const [endDateISOString] = useQueryState(
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

  const { data: eventTypesData } = useEventTypes(organization.id, {
    sorting: ['-last_seen'],
    root_events: true,
    source: 'user',
  })

  const eventTypes = eventTypesData?.items || []

  const {
    data: eventsData,
    isLoading: isEventsLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    limit: 50,
    sorting: ['-timestamp'],
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    // @ts-expect-error - event_type_id is intentionally excluded from public schema
    aggregate_fields: ['_cost.amount'],
    name: eventTypes.map((et) => et.name),
  })

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  return (
    <div className="">
      <div className="mb-12 flex flex-row items-center justify-between gap-y-4">
        <h3 className="text-4xl">Events</h3>
      </div>

      <CostsEventsTable
        organization={organization}
        spanId={''}
        events={events}
        eventTypes={eventTypes}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
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
