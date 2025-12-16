import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { toValueDataPoints, useMetrics } from '@/hooks/polar/metrics'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useMemo } from 'react'
import { CartesianChart, Line } from 'victory-native'
import { getFormattedMetricValue } from './utils'

interface ChartProps {
  currentPeriodData: ReturnType<typeof useMetrics>['data']
  previousPeriodData: ReturnType<typeof useMetrics>['data']
  title?: string
  trend?: number
  height?: number
  showTotal?: boolean
  strokeWidth?: number
  showPreviousPeriodTotal?: boolean
  metric: schemas['Metric'] & {
    key: keyof schemas['MetricsTotals']
  }
  currentPeriod: {
    startDate: Date
    endDate: Date
  }
}

export const Chart = ({
  currentPeriodData,
  previousPeriodData,
  title,
  height = 80,
  strokeWidth = 2,
  showPreviousPeriodTotal = true,
  metric,
  currentPeriod,
}: ChartProps) => {
  const theme = useTheme()

  const totalValue = useMemo(() => {
    return currentPeriodData?.totals[metric.key] ?? 0
  }, [currentPeriodData, metric.key])

  const formattedTotal = useMemo(() => {
    return getFormattedMetricValue(metric, totalValue)
  }, [totalValue, metric])

  const previousPeriodTotalValue = useMemo(() => {
    return previousPeriodData?.totals[metric.key]
  }, [previousPeriodData, metric.key])

  const previousPeriodFormattedTotal = useMemo(() => {
    return previousPeriodTotalValue != null
      ? getFormattedMetricValue(metric, previousPeriodTotalValue)
      : null
  }, [previousPeriodTotalValue, metric])

  const currentPeriodDataPoints = toValueDataPoints(
    currentPeriodData,
    metric.key,
  )
  const previousPeriodDataPoints = toValueDataPoints(
    previousPeriodData,
    metric.key,
  )

  const chartData = useMemo(() => {
    return currentPeriodDataPoints.map((point, index) => ({
      index,
      current: point.value,
      previous: previousPeriodDataPoints[index]?.value ?? 0,
    }))
  }, [currentPeriodDataPoints, previousPeriodDataPoints])

  const values = [
    ...currentPeriodDataPoints.map((d) => d.value),
    ...previousPeriodDataPoints.map((d) => d.value),
  ]

  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)

  return (
    <Box
      backgroundColor="card"
      padding="spacing-24"
      borderRadius="border-radius-24"
      gap="spacing-12"
    >
      <Box flexDirection="row" justifyContent="space-between">
        {title ? <Text variant="subtitle">{title}</Text> : null}
      </Box>

      <Box flexDirection="row" alignItems="baseline" gap="spacing-8">
        <Text variant="headlineXLarge">{formattedTotal}</Text>
        {showPreviousPeriodTotal &&
        typeof previousPeriodFormattedTotal !== 'undefined' ? (
          <Text color="subtext">{`vs. ${previousPeriodFormattedTotal}`}</Text>
        ) : null}
      </Box>

      {chartData.length > 0 ? (
        <Box style={{ width: '100%', height }}>
          <CartesianChart
            data={chartData}
            xKey="index"
            yKeys={['current', 'previous']}
            domain={{ y: [minValue, maxValue] }}
            domainPadding={{ top: 4, bottom: 4 }}
            axisOptions={{
              lineColor: 'transparent',
              labelColor: 'transparent',
            }}
            frame={{ lineColor: 'transparent' }}
          >
            {({ points }) => (
              <>
                <Line
                  points={points.previous}
                  color={theme.colors.secondary}
                  strokeWidth={strokeWidth}
                  curveType="monotoneX"
                />
                <Line
                  points={points.current}
                  color={theme.colors.primary}
                  strokeWidth={strokeWidth}
                  curveType="monotoneX"
                />
              </>
            )}
          </CartesianChart>
        </Box>
      ) : null}
      <Box flexDirection="row" justifyContent="space-between">
        <Text variant="caption" color="subtext">
          {format(currentPeriod.startDate, 'MMM d')}
        </Text>
        <Text variant="caption" color="subtext" textAlign="right">
          {format(currentPeriod.endDate, 'MMM d')}
        </Text>
      </Box>
    </Box>
  )
}
