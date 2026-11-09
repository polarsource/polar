import { useEventHistogram } from '@/hooks/queries/events'
import { formatEventCount } from '@/utils/event'
import { schemas } from '@polar-sh/client'
import { isHourlyRange, TimeRange } from './EventsHistogramControls'
import { Histogram } from './Histogram'

const formatEvents = (count: number) =>
  `${formatEventCount(count)} ${count === 1 ? 'event' : 'events'}`

export const EventsHistogram = ({
  organizationId,
  startDate,
  endDate,
  eventNames,
  customerIds,
  source,
  filter,
  query,
  metadata,
  selection,
  onSelectionChange,
  onZoom,
  earliest,
  latest,
}: {
  organizationId: string
  startDate: Date
  endDate: Date
  eventNames: string[] | null
  customerIds: string[] | null
  source: schemas['EventSource'] | null
  filter: string | null
  query: string | null
  metadata: Record<string, string | number | boolean> | null
  selection: TimeRange | null
  onSelectionChange: (selection: TimeRange | null) => void
  onZoom: (range: TimeRange, selection: TimeRange | null) => void
  earliest: Date
  latest: Date
}) => {
  const { data } = useEventHistogram(organizationId, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    name: eventNames && eventNames.length > 0 ? eventNames : null,
    customer_id: customerIds,
    source,
    filter,
    query,
    metadata: metadata ?? undefined,
  })

  const bars = (data?.buckets ?? []).map((bucket) => ({
    start: new Date(bucket.start),
    end: new Date(bucket.end),
    value: bucket.count,
  }))

  return (
    <Histogram
      bars={bars}
      startDate={startDate}
      endDate={endDate}
      hourly={isHourlyRange(startDate, endDate)}
      summarize={(first, last) =>
        formatEvents(
          bars.slice(first, last + 1).reduce((sum, bar) => sum + bar.value, 0),
        )
      }
      formatValue={formatEvents}
      selection={selection}
      onSelectionChange={onSelectionChange}
      onZoom={onZoom}
      earliest={earliest}
      latest={latest}
    />
  )
}
