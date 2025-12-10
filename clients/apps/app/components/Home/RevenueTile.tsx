import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { useRevenueTrend } from '@/hooks/trend'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { subMonths } from 'date-fns'
import { useContext, useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ThemedText } from '../Shared/ThemedText'
import { Tile } from './Tile'

export const RevenueTile = () => {
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)

  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

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
      <Box
        flex={1}
        flexDirection="column"
        justifyContent="space-between"
        gap="spacing-4"
      >
        <Box flexDirection="column" gap="spacing-4">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-4"
          >
            <ThemedText style={[styles.subtitle]} secondary>
              Revenue
            </ThemedText>
          </Box>
          <ThemedText style={[styles.title]}>30 Days</ThemedText>
        </Box>
        {cumulativeRevenueData && (
          <Box
            flex={1}
            flexGrow={1}
            width="100%"
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
                        ? 1
                        : (index / (cumulativeRevenueData.length - 1)) *
                          (width - 2)

                    const values = cumulativeRevenueData.map((d) => d.value)
                    const maxValue = Math.max(...values)
                    const minValue = Math.min(...values)
                    const valueRange = Math.abs(maxValue - minValue) || 1

                    const y =
                      height -
                      2 -
                      ((period.value - minValue) / valueRange) * (height - 4)

                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  })
                  .join(' ')}
                stroke={theme.colors.primary}
                strokeWidth="2"
                fill="none"
              />
            </Svg>
          </Box>
        )}
        <ThemedText style={[styles.revenueValue]} numberOfLines={1}>
          {formatCurrencyAndAmount(
            metrics.data?.totals.revenue ?? 0,
            'usd',
            0,
            undefined,
            0,
          )}
        </ThemedText>
      </Box>
    </Tile>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 22,
  },
})
