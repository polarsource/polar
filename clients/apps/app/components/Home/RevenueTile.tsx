import { useMetrics } from '@/hooks/polar/metrics'
import { useTheme } from '@/hooks/theme'
import { useRevenueTrend } from '@/hooks/trend'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { subMonths } from 'date-fns'
import { useContext, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ThemedText } from '../Shared/ThemedText'
import { Tile } from './Tile'

export const RevenueTile = () => {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()

  const metricParameters = useMemo(
    () => ({
      currentInterval: [subMonths(new Date(), 1), new Date()] as [Date, Date],
      previousInterval: [
        subMonths(new Date(), 2),
        subMonths(new Date(), 1),
      ] as [Date, Date],
      interval: 'day' as const,
    }),
    [],
  )

  const metrics = useMetrics(
    organization?.id,
    metricParameters.currentInterval[0],
    metricParameters.currentInterval[1],
    {
      interval: metricParameters.interval,
    },
  )

  const revenueTrend = useRevenueTrend(
    metricParameters.currentInterval,
    metricParameters.previousInterval,
    {
      interval: metricParameters.interval,
    },
  )

  const cumulativeRevenue = revenueTrend.currentCumulativeRevenue

  const cumulativeRevenueData = useMemo(() => {
    return (
      metrics.data?.periods.reduce<{ value: number; date: Date }[]>(
        (acc, period) => [
          ...acc,
          {
            value: (acc[acc.length - 1]?.value ?? 0) + (period.revenue ?? 0),
            date: period.timestamp,
          },
        ],
        [],
      ) ?? []
    )
  }, [metrics])

  return (
    <Tile href="/metrics">
      <View style={styles.container}>
        <View style={{ flexDirection: 'column', gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <ThemedText style={[styles.subtitle]} secondary>
              Revenue
            </ThemedText>
          </View>
          <ThemedText style={[styles.title]}>30 Days</ThemedText>
        </View>
        {cumulativeRevenueData && (
          <View
            style={{ height: 40, width: '100%' }}
            onLayout={(event) => {
              setHeight(event.nativeEvent.layout.height)
              setWidth(event.nativeEvent.layout.width)
            }}
          >
            <Svg height={height} width={width} preserveAspectRatio="none">
              <Path
                d={cumulativeRevenueData
                  .map((period, index) => {
                    const x =
                      index === 0
                        ? 1 // Start 1px in to avoid clipping
                        : (index / (cumulativeRevenueData.length - 1)) *
                          (width - 2) // Subtract 2 to avoid clipping

                    const values = cumulativeRevenueData.map((d) => d.value)
                    const maxValue = Math.max(...values)
                    const minValue = Math.min(...values)
                    const valueRange = Math.abs(maxValue - minValue) || 1 // Prevent division by zero

                    // Scale y value between top and bottom padding
                    const y =
                      height -
                      2 - // Bottom padding
                      ((period.value - minValue) / valueRange) * (height - 4) // Scale to available height

                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  })
                  .join(' ')}
                stroke={colors.primary}
                strokeWidth="2"
                fill="none"
              />
            </Svg>
          </View>
        )}
        <ThemedText style={[styles.revenueValue]}>
          {formatCurrencyAndAmount(cumulativeRevenue, 'usd', 0, 'compact')}
        </ThemedText>
      </View>
    </Tile>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 26,
  },
})
