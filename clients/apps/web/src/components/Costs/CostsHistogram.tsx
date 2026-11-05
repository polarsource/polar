import { TimeRange } from '@/components/Events/EventsHistogramControls'
import { HistogramChart } from '@/components/Events/HistogramChart'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import { formatCostAmount } from '@/utils/formatters'
import {
  CostRange,
  parseCost,
  pickCostInterval,
  toStatsDates,
} from './costRanges'

export const CostsHistogram = ({
  organizationId,
  range,
  customerIds,
  selection,
  onSelectionChange,
  onZoom,
  earliest,
  latest,
}: {
  organizationId: string
  range: CostRange
  customerIds: string[] | null
  selection: TimeRange | null
  onSelectionChange: (selection: TimeRange | null) => void
  onZoom: (range: TimeRange, selection: TimeRange | null) => void
  earliest: Date
  latest: Date
}) => {
  const interval = pickCostInterval(range)
  const { data } = useEventHierarchyStats(organizationId, {
    ...toStatsDates(range),
    interval,
    aggregate_fields: ['_cost.amount'],
    customer_id: customerIds && customerIds.length > 0 ? customerIds : null,
  })

  return (
    <HistogramChart
      bars={(data?.periods ?? []).map((period) => ({
        start: new Date(period.period_start),
        end: new Date(period.period_end),
        value: period.stats.reduce(
          (sum, stat) => sum + parseCost(stat.totals),
          0,
        ),
      }))}
      startDate={range.from}
      endDate={range.to}
      hourly={interval === 'hour'}
      formatTotal={formatCostAmount}
      formatBar={formatCostAmount}
      selection={selection}
      onSelectionChange={onSelectionChange}
      onZoom={onZoom}
      earliest={earliest}
      latest={latest}
    />
  )
}
