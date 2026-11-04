import { useEventHistogram } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { HistogramBar, HistogramTooltip } from './HistogramBar'
import { useElementWidth } from './useElementWidth'
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

interface Bar {
  start: Date
  end: Date
  count: number
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

  const bars: Bar[] = (data?.buckets ?? []).map((bucket) => ({
    start: new Date(bucket.start),
    end: new Date(bucket.end),
    count: bucket.count,
  }))
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
  const [measureRef, chartWidth] = useElementWidth<HTMLDivElement>()
  const barGap = bars.length > 60 ? 2 : 4
  // Fractional flex widths round each edge separately, so gaps came out 1 to
  // 3px. Whole-pixel slots keep every gap exact; bar widths vary by at most 1px.
  const slotEdge = (index: number) =>
    Math.floor((index * chartWidth) / bars.length)
  const isMeasured =
    bars.length > 0 && Math.floor(chartWidth / bars.length) - barGap >= 1
  // Align the band with bar edges: from the first bar's left edge to the last
  // bar's right edge, leaving out the gap that follows it.
  const toPixel = (fraction: number) => Math.floor(fraction * chartWidth + 1e-6)
  const brushLeft = brush
    ? isMeasured
      ? toPixel(brush.start)
      : `${brush.start * 100}%`
    : 0
  const brushWidth = brush
    ? isMeasured
      ? Math.max(0, toPixel(brush.end) - barGap - toPixel(brush.start))
      : `${(brush.end - brush.start) * 100}%`
    : 0
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
        <div ref={measureRef} className="flex w-full justify-center">
          <div
            className={twMerge(
              'relative isolate flex h-12 w-full touch-pan-y items-end select-none',
              CURSOR_CLASS[cursor],
            )}
            style={{ gap: barGap, paddingRight: isMeasured ? barGap : 0 }}
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
                width={
                  isMeasured
                    ? slotEdge(index + 1) - slotEdge(index) - barGap
                    : undefined
                }
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
                left={brushLeft}
                width={brushWidth}
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
