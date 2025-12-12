'use client'

import { useEventHierarchyStats } from '@/hooks/queries/events'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { endOfDay, subMonths } from 'date-fns'
import { parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { getDefaultEndDate, getDefaultStartDate } from '../utils'
import { EventRow } from './components/EventRow'
import {
  generateDateRange,
  groupEmptyDates,
  groupEventsByDay,
} from './components/utils'

export default function CostsEventsTable({
  organization,
  spanId,
  events,
  eventTypes,
  hasNextPage,
  fetchNextPage,
}: {
  organization: schemas['Organization']
  spanId: schemas['EventTypeWithStats']['id']
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

  const { data: hierarchyStats, isLoading: isHierarchyLoading } =
    useEventHierarchyStats(
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

  const eventTypesMap = eventTypes.reduce<
    Record<string, schemas['EventTypeWithStats']>
  >((acc, curr) => {
    acc[curr.name] = curr
    return acc
  }, {})

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

  const showEventTypes = !spanId

  const costDeviationMetadata = useMemo(() => {
    if (!hierarchyStats?.totals || hierarchyStats.totals.length === 0) {
      return undefined
    }

    const stat = hierarchyStats.totals[0]
    const average = parseFloat(stat.averages?.['_cost_amount'] || '0')
    const p10 = parseFloat(stat.p10?.['_cost_amount'] || '0')
    const p90 = parseFloat(stat.p90?.['_cost_amount'] || '0')

    return {
      average,
      p10,
      p90,
    }
  }, [hierarchyStats])

  return events.length > 0 ? (
    <div>
      <div className="dark:border-polar-700 w-full border-collapse overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full table-auto border-collapse rounded-lg">
          <thead>
            <tr>
              {showEventTypes && (
                <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium whitespace-nowrap text-gray-600">
                  Event Type
                </th>
              )}
              <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium whitespace-nowrap text-gray-600">
                Event
              </th>
              <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium whitespace-nowrap text-gray-600">
                Customer
              </th>
              <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium whitespace-nowrap text-gray-600">
                Timestamp
              </th>
              <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-right text-sm font-medium whitespace-nowrap text-gray-600">
                Cost
              </th>
            </tr>
          </thead>
          {dayGroups.map((group, groupIndex) => {
            return (
              <tbody
                key={
                  group.type === 'empty-range'
                    ? `empty-${groupIndex}`
                    : `day-${group.date.toISOString()}`
                }
                className="dark:divide-polar-700 group divide-y divide-gray-200"
              >
                <tr className="dark:bg-polar-800 bg-gray-50 not-group-first-of-type:border-t">
                  <th
                    colSpan={showEventTypes ? 5 : 4}
                    className="dark:text-polar-400 p-2 text-left text-sm font-normal text-gray-400"
                  >
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
                  </th>
                </tr>
                {group.type === 'empty-range' ? (
                  <tr>
                    <td
                      colSpan={showEventTypes ? 5 : 4}
                      className="dark:text-polar-600 p-2 text-center text-sm text-gray-400 italic"
                    >
                      No events
                    </td>
                  </tr>
                ) : (
                  group.events.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      organization={organization}
                      eventType={eventTypesMap[event.name]}
                      showEventType={showEventTypes}
                      costDeviationMetadata={costDeviationMetadata}
                    />
                  ))
                )}
              </tbody>
            )
          })}
          <tfoot>
            <tr>
              <td
                colSpan={showEventTypes ? 5 : 4}
                className="dark:border-polar-700 border-t border-gray-200"
              >
                {hasNextPage ? (
                  <button
                    className="group dark:text-polar-500 dark:hover:bg-polar-700 dark:hover:text-polar-300 relative flex h-10 w-full cursor-pointer items-center justify-center gap-x-2 py-3 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                    onClick={() => fetchNextPage()}
                  >
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100 transition-all duration-200 group-hover:opacity-0 group-hover:blur-[2px]">
                      Showing first {events.length} events
                    </span>
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 blur-[2px] transition-all duration-200 group-hover:opacity-100 group-hover:blur-none">
                      Load more
                    </span>
                  </button>
                ) : (
                  <span className="group dark:text-polar-500/60 dark:bg-polar-800 relative flex h-10 w-full items-center justify-center gap-x-2 bg-gray-50 py-3 text-sm text-gray-400">
                    Showing all {events.length} events
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  ) : (
    <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
      <h1 className="text-2xl font-normal">No events found</h1>
      <p className="dark:text-polar-500 text-gray-500">
        There are no events matching these filters
      </p>
    </div>
  )
}
