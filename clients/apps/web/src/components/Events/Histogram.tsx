import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { HistogramBar, HistogramTooltip } from './HistogramBar'
import { useElementWidth } from './useElementWidth'
import {
  EventsHistogramControls,
  formatBarStart,
  TimeRange,
} from './EventsHistogramControls'
import {
  Brush,
  brushIndices,
  BrushCursor,
  useHistogramSelection,
} from './useHistogramSelection'
import { zoomOut } from './histogramZoom'

export interface HistogramBarData {
  start: Date
  end: Date
  value: number
}

const CURSOR_CLASS: Record<BrushCursor, string> = {
  crosshair: 'cursor-crosshair',
  grab: 'cursor-grab',
  grabbing: 'cursor-grabbing',
  'ew-resize': 'cursor-ew-resize',
}

const toBrush = (
  bars: HistogramBarData[],
  range: TimeRange | null,
): Brush | null => {
  if (!range || bars.length === 0) return null
  const start = bars.findIndex((bar) => bar.end > range.from)
  const end = bars.findLastIndex((bar) => bar.start < range.to)
  return start < 0 || end < start
    ? null
    : { start: start / bars.length, end: (end + 1) / bars.length }
}

// The event explorer's brushable histogram. `summarize` labels the bars in
// view (inclusive indices), `formatValue` labels one bar.
export const Histogram = ({
  bars,
  startDate,
  endDate,
  hourly,
  height = 48,
  summarize,
  formatValue,
  selection,
  onSelectionChange,
  onZoom,
  earliest,
  latest,
}: {
  bars: HistogramBarData[]
  startDate: Date
  endDate: Date
  hourly: boolean
  height?: number
  summarize: (first: number, last: number) => string
  formatValue: (value: number) => string
  selection: TimeRange | null
  onSelectionChange: (selection: TimeRange | null) => void
  onZoom: (range: TimeRange, selection: TimeRange | null) => void
  earliest: Date
  latest: Date
}) => {
  const max = Math.max(1e-9, ...bars.map((bar) => bar.value))
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
  const brushBars = brush ? brushIndices(brush, bars.length) : null
  const hoveredBar = hovered !== null ? bars[hovered] : undefined
  const tooltipBar =
    !brush && !dragging && hoveredBar && hoveredBar.value > 0
      ? hoveredBar
      : null

  return (
    <Box flexDirection="column" gap="s" flexShrink={0}>
      <EventsHistogramControls
        anchor={brush ?? { start: 0, end: 1 }}
        dragging={dragging}
        range={brushRange ?? { from: startDate, to: endDate }}
        summary={
          bars.length === 0
            ? ''
            : brushBars
              ? summarize(brushBars.first, brushBars.last)
              : summarize(0, bars.length - 1)
        }
        hourly={hourly}
        onZoomIn={brushRange ? () => onZoom(brushRange, null) : undefined}
        onZoomOut={
          startDate > earliest || endDate < latest
            ? () =>
                onZoom(
                  zoomOut(
                    { from: startDate, to: endDate },
                    { from: earliest, to: latest },
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
              'relative isolate flex w-full touch-pan-y items-end select-none',
              CURSOR_CLASS[cursor],
            )}
            style={{
              height,
              gap: barGap,
              paddingRight: isMeasured ? barGap : 0,
            }}
            {...handlers}
          >
            {bars.map((bar, index) => (
              <HistogramBar
                key={bar.start.toISOString()}
                count={bar.value}
                max={max}
                index={index}
                total={bars.length}
                state={isActive(index) ? 'active' : brush ? 'dimmed' : 'idle'}
                highlighted={!brush && index === hovered && bar.value > 0}
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
                label={`${formatBarStart(tooltipBar.start, hourly)} · ${formatValue(tooltipBar.value)}`}
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
