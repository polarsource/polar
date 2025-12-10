import { ThemedText } from '@/components/Shared/ThemedText'
import { useTheme } from '@/design-system/useTheme'
import { toValueDataPoints, useMetrics } from '@/hooks/polar/metrics'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
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
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        {title && <ThemedText style={styles.title}>{title}</ThemedText>}
      </View>

      <View style={styles.totalValueContainer}>
        <ThemedText style={styles.totalValue}>{formattedTotal}</ThemedText>
        {showPreviousPeriodTotal &&
        typeof previousPeriodFormattedTotal !== 'undefined' ? (
          <ThemedText style={styles.previousPeriodTotalValue} secondary>
            {`vs. ${previousPeriodFormattedTotal}`}
          </ThemedText>
        ) : null}
      </View>

      <View
        style={[styles.chartView, { height }]}
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
      </View>
      <View style={styles.chartTimeline}>
        <ThemedText style={styles.chartTimelineText} secondary>
          {format(currentPeriod.startDate, 'MMM d')}
        </ThemedText>
        <ThemedText
          style={[styles.chartTimelineText, { textAlign: 'right' }]}
          secondary
        >
          {format(currentPeriod.endDate, 'MMM d')}
        </ThemedText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 18,
  },
  totalValue: {
    fontSize: 36,
  },
  totalValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  previousPeriodTotalValue: {
    fontSize: 16,
  },
  chartView: {
    width: '100%',
  },
  chartTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartTimelineText: {
    fontSize: 12,
  },
})
