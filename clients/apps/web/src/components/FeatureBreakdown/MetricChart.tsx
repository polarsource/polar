import { TimeRange } from '@/components/Events/EventsHistogramControls'
import { Histogram } from '@/components/Events/Histogram'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import {
  FeaturePeriod,
  formatMetric,
  Metric,
  METRICS,
  metricValue,
  sumPeriods,
} from './featureEconomics'
import { useFeatureRange } from './useFeatureRange'

const BARS = 30

// Groups consecutive periods so the chart has at most BARS bars. Each bar runs
// until the next one starts, and the last until the range ends.
const toChunks = (periods: FeaturePeriod[]) => {
  const size = Math.max(1, Math.ceil(periods.length / BARS))
  return Array.from({ length: Math.ceil(periods.length / size) }, (_, index) =>
    periods.slice(index * size, (index + 1) * size),
  )
}

const inRange = (bar: { start: Date; end: Date }, range: TimeRange | null) =>
  !range || (bar.end > range.from && bar.start < range.to)

export const MetricChart = ({
  periods,
  range,
  metric,
  currency,
  caption,
}: {
  periods: FeaturePeriod[]
  range: ReturnType<typeof useFeatureRange>
  metric: Metric
  currency: string
  caption?: ReactNode
}) => {
  // Periods still to come are always empty, so the bars end now.
  const chunks = toChunks(
    periods.filter((period) => new Date(period.timestamp) < range.latest),
  )
  // Per-use metrics are taken over the summed periods, not added up.
  const value = (group: FeaturePeriod[]) =>
    metricValue(metric, sumPeriods(group))
  const bars = chunks.map((chunk, index) => ({
    start: new Date(chunk[0].timestamp),
    end: new Date(
      chunks[index + 1]?.[0].timestamp ??
        Math.min(range.dateRange.to.getTime(), range.latest.getTime()),
    ),
    value: value(chunk),
  }))
  const format = (amount: number) => formatMetric(metric, amount, currency)
  const summarize = (first: number, last: number) =>
    format(value(chunks.slice(first, last + 1).flat()))
  const visible = chunks
    .filter((_, index) => inRange(bars[index], range.selection))
    .flat()

  return (
    <Box flexDirection="column" gap="l">
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text color="muted">
          {METRICS.find((option) => option.value === metric)?.label}
        </Text>
        <Box alignItems="baseline" gap="m" minWidth={0}>
          <Text variant="heading-xs" tabularNums>
            {format(value(visible))}
          </Text>
          <Box flexShrink={0}>{caption}</Box>
        </Box>
      </Box>
      <Histogram
        bars={bars}
        startDate={range.dateRange.from}
        endDate={range.dateRange.to}
        hourly={range.interval === 'hour'}
        summarize={summarize}
        formatValue={format}
        selection={range.selection}
        onSelectionChange={range.setSelection}
        onZoom={range.zoom}
        earliest={range.earliest}
        latest={range.latest}
      />
    </Box>
  )
}

export const MetricPicker = ({
  value,
  onChange,
}: {
  value: Metric
  onChange: (metric: Metric) => void
}) => (
  <SegmentedControl<Metric>
    size="sm"
    value={value}
    onChange={onChange}
    options={METRICS}
  />
)
