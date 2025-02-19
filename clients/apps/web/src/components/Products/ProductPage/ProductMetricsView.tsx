import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricPeriod } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

export interface ProductMetricsViewProps {
  metrics?: schemas['Metrics']
  periods?: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  loading: boolean
}

export const ProductMetricsView = ({
  metrics,
  loading,
  periods,
  interval,
}: ProductMetricsViewProps) => {
  return (
    <div className="flex flex-col gap-y-12">
      <MetricChartBox
        data={periods ?? []}
        loading={loading}
        metric={metrics?.orders}
        interval={interval}
      />
      <MetricChartBox
        data={periods ?? []}
        loading={loading}
        metric={metrics?.revenue}
        interval={interval}
      />
    </div>
  )
}
