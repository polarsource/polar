import { useEventHierarchyStats } from '@/hooks/queries/events'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfToday, subMonths } from 'date-fns'
import { useMemo } from 'react'
import { EventRow } from './EventRow'

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

  return (
    <div className="flex flex-col gap-y-3">
      {events.map((event) => {
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
    </div>
  )
}
