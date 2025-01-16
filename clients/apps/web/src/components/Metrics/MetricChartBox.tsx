import { ParsedMetricPeriod } from '@/hooks/queries'
import { getTimestampFormatter, getValueFormatter } from '@/utils/metrics'
import { Interval, Metric } from '@polar-sh/api'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import MetricChart from './MetricChart'

interface MetricChartBoxProps {
  className?: string
  data: ParsedMetricPeriod[]
  interval: Interval
  metric: Metric
  height?: number
  maxTicks?: number
}

const MetricChartBox: React.FC<MetricChartBoxProps> = ({
  className,
  data,
  interval,
  metric,
  height,
  maxTicks,
}) => {
  const valueFormatter = useMemo(() => getValueFormatter(metric), [metric])
  const timestampFormatter = useMemo(
    () => getTimestampFormatter(interval),
    [interval],
  )
  const getHoverValueLabel = useCallback(
    (index: number | undefined) => {
      const hoveredIndex = index === undefined ? data.length - 1 : index
      const period = data[hoveredIndex]
        ? data[hoveredIndex]
        : data[data.length - 1]
      const timestamp = period.timestamp
      const value =
        period[metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>]
      return `${valueFormatter(value)} at ${timestampFormatter(timestamp)}`
    },
    [data, metric, valueFormatter, timestampFormatter],
  )

  const [hoverValueLabel, setHoverValueLabel] = useState<string>(
    getHoverValueLabel(undefined),
  )

  return (
    <div className={twMerge('flex flex-col gap-y-4', className)}>
      <div className="flex flex-row justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-lg">{metric.display_name}</div>
          {hoverValueLabel && (
            <div className="dark:text-polar-500 text-sm text-gray-500">
              {hoverValueLabel}
            </div>
          )}
        </div>
      </div>
      <MetricChart
        data={data}
        interval={interval}
        metric={metric}
        height={height}
        maxTicks={maxTicks}
        onDataIndexHover={(index) =>
          setHoverValueLabel(getHoverValueLabel(index))
        }
      />
    </div>
  )
}

export default MetricChartBox
