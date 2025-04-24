import { ParsedMetricPeriod } from '@/hooks/queries'
import { MetricMarksResolver } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useTheme } from 'next-themes'
import { twMerge } from 'tailwind-merge'

interface MetricChartProps {
  data: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  metric: schemas['Metric']
  height?: number
  maxTicks?: number
  onDataIndexHover?: (index: number | undefined) => void
  marks?: MetricMarksResolver
}

const MetricChart: React.FC<MetricChartProps> = ({
  data,
  interval,
  metric,
  height: _height,
  maxTicks: _maxTicks,
}) => {
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  return (
    <ChartContainer
      className="h-[300px]"
      config={{
        current: {
          label: 'Current',
          color: '#2563eb',
        },
        previous: {
          label: 'Previous',
          color: isDark ? '#383942' : '#ccc',
        },
        metric: {
          label: metric.display_name,
        },
      }}
    >
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 0,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            switch (interval) {
              case 'hour':
                return value.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              case 'day':
              case 'week':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                })
              case 'month':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: '2-digit',
                })
              case 'year':
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              default:
                return value.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                })
            }
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            if (metric?.type === 'currency') {
              return formatCurrencyAndAmount(value, 'USD', 0, 'compact')
            } else {
              return Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 2,
              }).format(value)
            }
          }}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="text-black dark:text-white"
              indicator="dot"
              labelKey="metric"
              formatter={(value, name) => {
                const formattedValue =
                  metric?.type === 'currency'
                    ? formatCurrencyAndAmount(
                        value as number,
                        'USD',
                        0,
                        'compact',
                      )
                    : Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 2,
                      }).format(value as number)

                return (
                  <div className="flex flex-row justify-between gap-x-8">
                    <div className="flex flex-row items-center gap-x-2">
                      <span
                        className={twMerge(
                          'bg-primary dark:bg-primary h-2 w-2 rounded-full',
                        )}
                      />
                      <span className="capitalize">
                        {name.toString().split('_').join(' ')}
                      </span>
                    </div>
                    <span>{formattedValue}</span>
                  </div>
                )
              }}
            />
          }
        />
        <Line
          dataKey={metric.slug}
          stroke="var(--color-current)"
          type="linear"
          dot={false}
          strokeWidth={1.5}
        />
      </LineChart>
    </ChartContainer>
  )
}

export default MetricChart
