import { useEventTimeseriesChunks } from '@/hooks/queries/events'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { addDays, min, startOfDay } from 'date-fns'
import { twMerge } from 'tailwind-merge'
import { HistogramBar, HistogramTooltip } from './HistogramBar'
import {
  EventsHistogramControls,
  formatBarStart,
  isHourlyRange,
  TimeRange,
} from './EventsHistogramControls'
import {
  Brush,
  brushIndices,
  BrushCursor,
  useHistogramSelection,
} from './useHistogramSelection'

const TARGET_BARS = 150
// The API caps hourly ranges at 7 days and daily ranges at 366 days.
const CHUNK_DAYS = { hour: 7, day: 366 }

interface Bar {
  start: Date
  end: Date
  count: number
}

const chunkRange = (startDate: Date, endDate: Date, size: number) => {
  const chunks: { start_date: string; end_date: string }[] = []
  const last = startOfDay(endDate)
  let cursor = startOfDay(startDate)
  while (cursor <= last) {
    const chunkEnd = min([addDays(cursor, size - 1), last])
    chunks.push({
      start_date: toISODate(cursor),
      end_date: toISODate(chunkEnd),
    })
    cursor = addDays(chunkEnd, 1)
  }
  return chunks
}

const rebin = (periods: Bar[]): Bar[] => {
  const size = Math.max(1, Math.ceil(periods.length / TARGET_BARS))
  const bars: Bar[] = []
  for (let i = 0; i < periods.length; i += size) {
    const group = periods.slice(i, i + size)
    bars.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      count: group.reduce((sum, period) => sum + period.count, 0),
    })
  }
  return bars
}

const CURSOR_CLASS: Record<BrushCursor, string> = {
  crosshair: 'cursor-crosshair',
  grab: 'cursor-grab',
  grabbing: 'cursor-grabbing',
  'ew-resize': 'cursor-ew-resize',
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ZOOM_LEVELS = [
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  12 * HOUR,
  DAY,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
  180 * DAY,
  365 * DAY,
]
const MIN_ZOOM_STEP = 1.5

// Steps to the next zoom level around the current center, never past `bounds`.
// Once the next level exceeds the bounds, it shows all of them.
const zoomOut = ({ from, to }: TimeRange, bounds: TimeRange): TimeRange => {
  const span = to.getTime() - from.getTime()
  const maxSpan = bounds.to.getTime() - bounds.from.getTime()
  const level =
    ZOOM_LEVELS.find((candidate) => candidate >= span * MIN_ZOOM_STEP) ??
    maxSpan
  const target = Math.min(level, maxSpan)
  const center = (from.getTime() + to.getTime()) / 2
  const end = Math.min(bounds.to.getTime(), center + target / 2)
  const start = Math.max(bounds.from.getTime(), end - target)
  return {
    from: new Date(start),
    to: new Date(Math.min(bounds.to.getTime(), start + target)),
  }
}

const toBrush = (bars: Bar[], range: TimeRange | null): Brush | null => {
  if (!range || bars.length === 0) return null
  const start = bars.findIndex((bar) => bar.end > range.from)
  const end = bars.findLastIndex((bar) => bar.start < range.to)
  return start < 0 || end < start
    ? null
    : { start: start / bars.length, end: (end + 1) / bars.length }
}

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
  const hourly = isHourlyRange(startDate, endDate)
  const interval = hourly ? 'hour' : 'day'

  const { data: chunkResults, isPending: isLoading } = useEventTimeseriesChunks(
    organizationId,
    chunkRange(startDate, endDate, CHUNK_DAYS[interval]),
    {
      interval,
      name: eventNames && eventNames.length > 0 ? eventNames : undefined,
      customer_id: customerIds ?? undefined,
      source: source ?? undefined,
      filter: filter ?? undefined,
      query: query ?? undefined,
      metadata: metadata ?? undefined,
    },
  )

  const seen = new Set<number>()
  const periods = (chunkResults ?? [])
    .flatMap((result) => result.periods)
    .map((period) => ({
      start: new Date(period.period_start),
      end: new Date(period.period_end),
      count: period.stats.reduce((sum, stat) => sum + stat.occurrences, 0),
    }))
    .filter((period) => period.end > startDate && period.start < endDate)
    .filter((period) => {
      const key = period.start.getTime()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .toSorted((a, b) => a.start.getTime() - b.start.getTime())

  const bars = isLoading ? [] : rebin(periods)
  const max = Math.max(1, ...bars.map((bar) => bar.count))
  const labels = [bars[0], bars[Math.floor(bars.length / 2)], bars.at(-1)]

  const toRange = (brush: Brush): TimeRange => {
    const { first, last } = brushIndices(brush, bars.length)
    return { from: bars[first].start, to: bars[last].end }
  }

  const { hovered, brush, dragging, cursor, handlers } = useHistogramSelection(
    bars.length,
    toBrush(bars, selection),
    (next) => onSelectionChange(toRange(next)),
  )
  const isActive = (index: number) => {
    if (!brush) return index === hovered
    const center = (index + 0.5) / bars.length
    return center >= brush.start && center <= brush.end
  }
  const brushRange = brush ? toRange(brush) : null
  const hoveredBar = hovered !== null ? bars[hovered] : undefined
  const tooltipBar =
    !brush && !dragging && hoveredBar && hoveredBar.count > 0
      ? hoveredBar
      : null
  const totalCount = bars.reduce((sum, bar) => sum + bar.count, 0)
  const brushCount = brush
    ? bars
        .filter((_, index) => isActive(index))
        .reduce((sum, bar) => sum + bar.count, 0)
    : 0

  return (
    <Box flexDirection="column" gap="s" flexShrink={0}>
      <EventsHistogramControls
        anchor={brush ?? { start: 0, end: 1 }}
        dragging={dragging}
        range={brushRange ?? { from: startDate, to: endDate }}
        count={brush ? brushCount : totalCount}
        hourly={hourly}
        onZoomIn={brushRange ? () => onZoom(brushRange, null) : undefined}
        onZoomOut={
          startDate > earliest || endDate < latest
            ? () =>
                onZoom(
                  zoomOut(
                    { from: startDate, to: endDate },
                    { from: earliest, to: new Date() },
                  ),
                  selection,
                )
            : undefined
        }
        onClear={selection ? () => onSelectionChange(null) : undefined}
      />
      <Box
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <div
          className={twMerge(
            'relative isolate flex h-12 w-full touch-pan-y items-end select-none',
            CURSOR_CLASS[cursor],
            bars.length > 60 ? 'gap-0.5' : 'gap-1',
          )}
          {...handlers}
        >
          {bars.map((bar, index) => (
            <HistogramBar
              key={bar.start.toISOString()}
              count={bar.count}
              max={max}
              index={index}
              total={bars.length}
              state={isActive(index) ? 'active' : brush ? 'dimmed' : 'idle'}
              highlighted={!brush && index === hovered && bar.count > 0}
            />
          ))}
          {tooltipBar && hovered !== null && (
            <HistogramTooltip
              index={hovered}
              total={bars.length}
              label={`${formatBarStart(tooltipBar.start, hourly)} · ${tooltipBar.count.toLocaleString('en-US')} ${tooltipBar.count === 1 ? 'event' : 'events'}`}
            />
          )}
          {brush && (
            <Box
              position="absolute"
              top={0}
              bottom={0}
              left={`${brush.start * 100}%`}
              width={`${(brush.end - brush.start) * 100}%`}
              transitionProperty={dragging ? 'none' : 'all'}
              transitionDuration="fast"
              ease="decelerate"
              justifyContent="between"
              pointerEvents="none"
              backgroundColor="background-card"
              zIndex={-1}
            >
              <Box
                width={2}
                height="100%"
                backgroundColor="background-inverse"
              />
              <Box
                width={2}
                height="100%"
                backgroundColor="background-inverse"
              />
            </Box>
          )}
        </div>
      </Box>
      <Box justifyContent="between" height={16}>
        {labels.map((bar, index) => (
          <Text key={index} variant="caption" color="muted" tabularNums>
            {bar ? formatBarStart(bar.start, hourly) : ''}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
