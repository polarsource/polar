import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue, getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  XAxis,
  YAxis,
} from '@polar-sh/ui/components/ui/chart'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useTheme } from 'next-themes'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

interface CashflowChartProps {
  ref: React.RefObject<HTMLDivElement>
  data?: ParsedMetricsResponse
  interval: schemas['TimeInterval']
  height?: number
  grid?: boolean
  onDataIndexHover?: (index: number | undefined) => void
  simple?: boolean
  className?: string
  loading?: boolean
}

// Custom shape component for revenue squares
const RevenueSquare = (props: any) => {
  const { x, y, height, width, payload } = props
  const { actualRevenue } = payload

  // Only render if there's actual revenue
  if (!actualRevenue || actualRevenue <= 0) return null

  return (
    <rect
      x={x}
      y={y - Math.abs(height) + 4}
      width={width}
      height={32}
      fill="var(--color-revenue)"
      rx={4}
      ry={4}
    />
  )
}

const CashflowChart = forwardRef<HTMLDivElement, CashflowChartProps>(
  (
    {
      data,
      interval,
      height: _height,
      onDataIndexHover,
      simple = false,
      className,
      loading,
    },
    ref,
  ) => {
    const { resolvedTheme } = useTheme()

    const isDark = resolvedTheme === 'dark'

    const timestampFormatter = getTimestampFormatter(interval)

    // Transform data for the chart
    const chartData = data?.periods.map((period) => ({
      timestamp: period.timestamp,
      costs: Math.abs(period.costs),
      revenueIndicator: period.revenue > 0 ? -1 : 0, // Negative dummy value to position below zero
      actualRevenue: period.revenue, // Real value for tooltip and custom shape
    }))

    return (
      <ShadowBox
        className={twMerge(
          'dark:bg-polar-800 flex w-full flex-col bg-gray-50 p-2 shadow-xs',
          className,
        )}
      >
        <div
          className={twMerge(
            'flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between',
          )}
        >
          <div className="flex flex-col gap-y-4">
            <h3 className="text-xl">Cashflow</h3>
            <h3 className="text-5xl font-light">
              {formatCurrencyAndAmount(
                data ? data.totals.net_cashflow : 0,
                'USD',
              )}
            </h3>
          </div>
        </div>
        <div
          className={twMerge(
            'dark:bg-polar-900 flex w-full flex-col gap-y-2 rounded-3xl bg-white py-4 pr-4',
          )}
        >
          {loading ? (
            <div
              style={{ height: _height }}
              className="flex flex-col items-center justify-center"
            >
              <Spinner />
            </div>
          ) : (
            <ChartContainer
              ref={ref}
              style={{ height: _height, width: '100%' }}
              config={{
                costs: {
                  label: 'Costs',
                  color: '#ef4444',
                },
                revenue: {
                  label: 'Revenue',
                  color: '#10b981',
                },
              }}
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                stackOffset="sign"
                margin={{
                  left: 24,
                  right: 24,
                  top: 24,
                }}
                onMouseMove={(state) => {
                  if (onDataIndexHover) {
                    onDataIndexHover(state.activeTooltipIndex as number)
                  }
                }}
                onMouseLeave={() => {
                  if (onDataIndexHover) {
                    onDataIndexHover(undefined)
                  }
                }}
              >
                <ChartTooltip
                  cursor={false}
                  content={({ payload }) => {
                    const data = payload[0]?.payload

                    return (
                      <div className="dark:bg-polar-800 flex w-48 flex-col gap-y-2 rounded-md bg-white p-2 text-black shadow-xl dark:text-white">
                        <span>Cashflow</span>
                        <div className="flex flex-col gap-y-1">
                          {/* Costs */}
                          <div className="flex w-full flex-row justify-between gap-x-2">
                            <div className="flex flex-row items-center gap-x-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: '#ef4444' }}
                              />
                              <span>Costs</span>
                            </div>
                            <span>
                              {getFormattedMetricValue(
                                {
                                  slug: 'costs',
                                  display_name: 'Costs',
                                  type: 'currency',
                                },
                                data?.costs ?? 0,
                              )}
                            </span>
                          </div>
                          {/* Revenue */}
                          {data?.actualRevenue > 0 && (
                            <div className="flex w-full flex-row justify-between gap-x-2">
                              <div className="flex flex-row items-center gap-x-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: '#10b981' }}
                                />
                                <span>Revenue</span>
                              </div>
                              <span>
                                {getFormattedMetricValue(
                                  {
                                    slug: 'revenue',
                                    display_name: 'Revenue',
                                    type: 'currency',
                                  },
                                  data.actualRevenue,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }}
                />
                {simple ? undefined : (
                  <CartesianGrid
                    horizontal={true}
                    vertical={false}
                    stroke={isDark ? '#222225' : '#ddd'}
                    strokeDasharray="6 6"
                  />
                )}
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => {
                    // Only show 0 and positive ticks
                    if (value < 0) return ''
                    return formatCurrencyAndAmount(value, 'USD', 0)
                  }}
                  domain={['auto', 'auto']}
                />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="equidistantPreserveStart"
                  tickFormatter={timestampFormatter}
                  stroke={isDark ? '#222225' : '#ddd'}
                />
                {/* Cost bars (red, upward) */}
                <Bar
                  dataKey="costs"
                  fill="var(--color-costs)"
                  radius={4}
                  stackId="cashflow"
                />
                {/* Revenue squares (green, custom shape) */}
                <Bar
                  dataKey="revenueIndicator"
                  fill="var(--color-revenue)"
                  shape={<RevenueSquare />}
                  stackId="cashflow"
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </ShadowBox>
    )
  },
)

CashflowChart.displayName = 'CashflowChart'

export default CashflowChart
