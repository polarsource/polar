import { ParsedMetricPeriod } from '@/hooks/queries'
import { EyeIcon } from '@heroicons/react/24/outline'
import { Interval, Metric } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { twMerge } from 'tailwind-merge'
import MetricChart from './MetricChart'

interface MetricChartBoxProps {
  data: ParsedMetricPeriod[]
  interval: Interval
  metric: Metric
  height?: number
  maxTicks?: number
  focused?: boolean
  onFocus?: () => void
}

const MetricChartBox: React.FC<MetricChartBoxProps> = ({
  data,
  interval,
  metric,
  height,
  maxTicks,
  focused,
  onFocus,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between">
        <div className="font-medium">{metric.display_name}</div>
        <EyeIcon
          className={twMerge(
            'h-4 w-4 cursor-pointer hover:text-blue-400',
            focused && 'cursor-not-allowed text-blue-400',
          )}
          onClick={onFocus}
        />
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
