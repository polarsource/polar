'use client'

import { CostDeviation } from '@/components/Events/CostDeviation'
import { EventRow } from '@/components/Events/EventRow'
import {
  generateDateRange,
  groupEmptyDates,
  groupEventsByDay,
} from '@/components/Events/eventTableUtils'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { endOfDay, subMonths } from 'date-fns'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useMemo, useRef } from 'react'
import { getDefaultEndDate, getDefaultStartDate } from '../utils'

export default function CostsEventsTable({
  organization,
  spanId,
  events,
  eventTypes,
  hasNextPage,
  fetchNextPage,
}: {
  organization: schemas['Organization']
  spanId?: schemas['EventTypeWithStats']['id']
  events: schemas['Event'][]
  eventTypes: schemas['EventTypeWithStats'][]
  hasNextPage: boolean
  fetchNextPage: () => void
}) {
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

  const { data: hierarchyStats } = useEventHierarchyStats(
    organization.id,
    {
      event_type_id: spanId,
      start_date: startDateISOString,
      end_date: endDateISOString,
      interval: 'month',
      aggregate_fields: ['_cost.amount'],
    },
    !!spanId,
  )

  const costDeviationMetadata = useMemo(() => {
    if (!hierarchyStats?.totals || hierarchyStats.totals.length === 0) {
      return undefined
    }
    const stat = hierarchyStats.totals[0]
    return {
      average: parseFloat(stat.averages?.['_cost_amount'] || '0'),
      p10: parseFloat(stat.p10?.['_cost_amount'] || '0'),
      p90: parseFloat(stat.p90?.['_cost_amount'] || '0'),
    }
  }, [hierarchyStats])

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage])

  const dayGroups = useMemo(() => {
    const eventsMap = groupEventsByDay(events)
    const dateRange = generateDateRange(startDate, endDate)
    const groups = groupEmptyDates(dateRange, eventsMap)

    // Remove the last group if it's an empty range (looks odd at the bottom)
    if (groups.length > 1 && groups[groups.length - 1].type === 'empty-range') {
      return groups.slice(0, -1)
    }

    return groups
  }, [events, startDate, endDate])

  return events.length > 0 && eventTypes.length > 0 ? (
    <div className="flex flex-col gap-y-8">
      {dayGroups.map((group, groupIndex) => (
        <div
          key={
            group.type === 'empty-range'
              ? `empty-${groupIndex}`
              : `day-${group.date.toISOString()}`
          }
          className="flex flex-col gap-y-2"
        >
          <span className="dark:text-polar-500 text-gray-500">
            {group.type === 'empty-range' ? (
              <FormattedInterval
                startDatetime={group.endDate}
                endDatetime={group.startDate}
              />
            ) : (
              <FormattedInterval
                startDatetime={group.date}
                endDatetime={group.date}
              />
            )}
          </span>
          {group.type === 'empty-range' ? (
            <div className="dark:border-polar-700 flex flex-col items-center justify-center rounded-2xl border border-gray-200 p-6">
              <p className="dark:text-polar-500 text-sm text-gray-500">
                No events
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-y-2">
              {group.events.map((event) => {
                const costMeta = (
                  event.metadata as {
                    _cost?: { amount?: string; currency?: string }
                  }
                )._cost
                const eventCost = Number(costMeta?.amount ?? 0)
                const eventCurrency = costMeta?.currency ?? 'usd'
                return (
                  <EventRow
                    key={event.id}
                    event={event}
                    organization={organization}
                    expandChildren
                    costBadge={
                      costDeviationMetadata && spanId ? (
                        <CostDeviation
                          eventCost={eventCost}
                          currency={eventCurrency}
                          averageCost={costDeviationMetadata.average}
                          p10Cost={costDeviationMetadata.p10}
                          p90Cost={costDeviationMetadata.p90}
                        />
                      ) : undefined
                    }
                  />
                )
              })}
            </div>
          )}
        </div>
      ))}
      <div ref={sentinelRef} />
    </div>
  ) : (
    <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-8 text-center md:p-24">
      <h1 className="text-2xl font-normal">No events found</h1>
      <p className="dark:text-polar-500 text-gray-500">
        There are no events matching these filters
      </p>
    </div>
  )
}
