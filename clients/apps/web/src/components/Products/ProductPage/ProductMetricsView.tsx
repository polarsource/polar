import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

export interface ProductMetricsViewProps {
  data?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  loading: boolean
}

export const ProductMetricsView = ({
  data,
  loading,
  interval,
}: ProductMetricsViewProps) => {
  return (
    <div className="flex flex-col gap-y-12">
      <MetricChartBox
        data={data}
        loading={loading}
        metric="orders"
        interval={interval}
      />
      <MetricChartBox
        data={data}
        loading={loading}
        metric="revenue"
        interval={interval}
      />
    </div>
  )
}
