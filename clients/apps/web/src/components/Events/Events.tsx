import { useEventHierarchyStats } from '@/hooks/queries/events'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { endOfToday, startOfDay, subMonths } from 'date-fns'
import { useMemo } from 'react'
import { EventRow } from './EventRow'

type DayGroup = {
  date: Date
  events: schemas['Event'][]
}

function groupEventsByDay(events: schemas['Event'][]): DayGroup[] {
  const grouped = new Map<string, schemas['Event'][]>()

  events.forEach((event) => {
    const eventDate = startOfDay(new Date(event.timestamp))
    const dateKey = eventDate.toISOString().split('T')[0]

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(event)
  })

  // Convert to array and sort by date descending
  return Array.from(grouped.entries())
    .map(([dateKey, events]) => ({
      date: new Date(dateKey),
      events,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const Events = ({
  events,
  organization,
  showSourceBadge = true,
}: {
  events: schemas['Event'][]
  organization: schemas['Organization']
  showSourceBadge?: boolean
}) => {
  // Get unique event names from the current events
  const eventNames = useMemo(() => {
    const names = new Set<string>()
    events.forEach((event) => {
      names.add(event.name)
    })
    return Array.from(names)
  }, [events])

  // Fetch hierarchy stats for cost metrics - filter by event names to get relevant stats
  const { data: hierarchyStats } = useEventHierarchyStats(
    organization.id,
    {
      start_date: toISODate(subMonths(endOfToday(), 1)),
      end_date: toISODate(endOfToday()),
      interval: 'day',
      aggregate_fields: ['_cost.amount'],
      // @ts-expect-error - event_name filter is valid but not in generated types
      event_name: eventNames.length > 0 ? eventNames : undefined,
    },
    eventNames.length > 0,
  )

  // Build a map of event name to cost metrics
  const costMetricsMap = useMemo(() => {
    const map = new Map<string, { averageCost: number; p99Cost: number }>()

    if (!hierarchyStats?.totals) return map

    hierarchyStats.totals.forEach((stat) => {
      const averageCost = parseFloat(stat.averages?.['_cost_amount'] || '0')
      const p99Cost = parseFloat(stat.p99?.['_cost_amount'] || '0')
      map.set(stat.name, { averageCost, p99Cost })
    })

    return map
  }, [hierarchyStats])

  // Group events by day
  const dayGroups = useMemo(() => groupEventsByDay(events), [events])

  return (
    <div className="dark:border-polar-700 w-full overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
              Event
            </th>
            <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
              Customer
            </th>
            <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-left text-sm font-medium text-gray-600">
              Time
            </th>
            <th className="dark:bg-polar-700 dark:text-polar-500 dark:border-polar-700 border-b border-gray-200 bg-gray-100 p-2 text-right text-sm font-medium text-gray-600">
              Cost
            </th>
          </tr>
        </thead>
        {dayGroups.map((group) => (
          <tbody
            key={group.date.toISOString()}
            className="dark:divide-polar-700 group divide-y divide-gray-200"
          >
            <tr className="dark:bg-polar-800 bg-gray-50">
              <th
                colSpan={4}
                className="dark:text-polar-400 p-2 text-left text-sm font-medium text-gray-600"
              >
                <FormattedDateTime
                  datetime={group.date.toISOString()}
                  resolution="date"
                />
              </th>
            </tr>
            {group.events.map((event) => {
              const costMetrics = costMetricsMap.get(event.name)
              return (
                <EventRow
                  key={event.id}
                  event={event}
                  organization={organization}
                  averageCost={costMetrics?.averageCost}
                  p99Cost={costMetrics?.p99Cost}
                  showSourceBadge={showSourceBadge}
                />
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
