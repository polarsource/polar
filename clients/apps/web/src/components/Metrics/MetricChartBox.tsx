import { ParsedMetricPeriod } from '@/hooks/queries'
import { Interval, Metric } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import MetricChart from './MetricChart'

interface MetricChartBoxProps {
  data: ParsedMetricPeriod[]
  interval: Interval
  metric: Metric
  height?: number
  maxTicks?: number
}

const MetricChartBox: React.FC<MetricChartBoxProps> = ({
  data,
  interval,
  metric,
  height,
  maxTicks,
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="font-medium">{metric.display_name}</div>
      </CardHeader>
      <CardContent>
        <MetricChart
          data={data}
          interval={interval}
          metric={metric}
          height={height}
          maxTicks={maxTicks}
        />
      </CardContent>
    </Card>
  )
}

export default MetricChartBox
