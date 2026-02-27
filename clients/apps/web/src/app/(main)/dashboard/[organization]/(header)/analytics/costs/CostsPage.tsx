'use client'

import { useEventTypes } from '@/hooks/queries/event_types'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfDay, subMonths } from 'date-fns'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import CostsEventsTable from './[spanId]/CostsEventsTable'
import { getDefaultEndDate, getDefaultStartDate } from './utils'

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
    const endDate = endDateISOString
      ? endOfDay(fromISODate(endDateISOString))
      : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const { data: eventTypesData } = useEventTypes(organization.id, {
    sorting: ['-last_seen'],
    root_events: true,
    source: 'user',
  })

  const eventTypes = eventTypesData?.items || []

  const [customerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString),
  )

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
    customer_id: customerIds,
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
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h3 className="text-2xl font-medium whitespace-nowrap dark:text-white">
          Events
        </h3>
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
