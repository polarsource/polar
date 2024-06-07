import { ParsedMetricPeriod } from '@/hooks/queries'
import { getTimestampFormatter, getValueFormatter } from '@/utils/metrics'
import { EyeIcon } from '@heroicons/react/24/outline'
import { Interval, Metric } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useEffect, useMemo, useState } from 'react'
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
  const valueFormatter = useMemo(() => getValueFormatter(metric), [metric])
  const timestampFormatter = useMemo(
    () => getTimestampFormatter(interval),
    [interval],
  )
  const [hoverValueLabel, setHoverValueLabel] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number>(data.length - 1)
  useEffect(() => {
    console.log(hoveredIndex)
    const period = data[hoveredIndex]
    if (!period) {
      return
    }

    const timestamp = period.timestamp
    const value =
      period[metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>]
    setHoverValueLabel(
      `${valueFormatter(value)} at ${timestampFormatter(timestamp)}`,
    )
  }, [hoveredIndex, data, metric, valueFormatter, timestampFormatter])

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between">
        <div className="flex flex-col gap-2">
          <div className="font-medium">{metric.display_name}</div>
          {hoverValueLabel && (
            <div className="text-muted-foreground text-sm">
              {hoverValueLabel}
            </div>
          )}
        </div>
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
          onDataIndexHover={(index) =>
            setHoveredIndex(index !== undefined ? index : data.length - 1)
          }
        />
      </CardContent>
    </Card>
  )
}

export default MetricChartBox
