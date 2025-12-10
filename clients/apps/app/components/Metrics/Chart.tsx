import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { toValueDataPoints, useMetrics } from '@/hooks/polar/metrics'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import Svg from 'react-native-svg'
import { ChartPath } from './ChartPath'
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
  const [width, setWidth] = useState(0)
  const [chartHeight, setChartHeight] = useState(0)

  const totalValue = useMemo(() => {
    return currentPeriodData?.totals[metric.key] ?? 0
  }, [currentPeriodData])

  const formattedTotal = useMemo(() => {
    return getFormattedMetricValue(metric, totalValue)
  }, [totalValue, metric])

  const previousPeriodTotalValue = useMemo(() => {
    return previousPeriodData?.totals[metric.key]
  }, [previousPeriodData])

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

  const values = [
    ...currentPeriodDataPoints.map((d) => d.value),
    ...previousPeriodDataPoints.map((d) => d.value),
  ]

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  return (
    <Box
      backgroundColor="card"
      padding="spacing-24"
      borderRadius="border-radius-24"
      gap="spacing-12"
    >
      <Box flexDirection="row" justifyContent="space-between">
        {title && <Text variant="subtitle">{title}</Text>}
      </Box>

      <Box flexDirection="row" alignItems="baseline" gap="spacing-8">
        <Text variant="headlineXLarge">{formattedTotal}</Text>
        {showPreviousPeriodTotal &&
        typeof previousPeriodFormattedTotal !== 'undefined' ? (
          <Text color="subtext">{`vs. ${previousPeriodFormattedTotal}`}</Text>
        ) : null}
      </Box>

      <Box
        style={{ width: '100%', height }}
        onLayout={(event) => {
          setChartHeight(event.nativeEvent.layout.height)
          setWidth(event.nativeEvent.layout.width)
        }}
      >
        <Svg height={chartHeight} width={width} preserveAspectRatio="none">
          <ChartPath
            dataPoints={previousPeriodDataPoints}
            width={width}
            chartHeight={chartHeight}
            strokeWidth={strokeWidth}
            strokeColor={theme.colors.secondary}
            minValue={minValue}
            maxValue={maxValue}
          />
          <ChartPath
            dataPoints={currentPeriodDataPoints}
            width={width}
            chartHeight={chartHeight}
            strokeWidth={strokeWidth}
            strokeColor={theme.colors.primary}
            minValue={minValue}
            maxValue={maxValue}
          />
        </Svg>
      </Box>
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
