import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { subMonths } from 'date-fns'
import { useContext, useEffect, useMemo } from 'react'
import { useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { CartesianChart, Line } from 'victory-native'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface OrdersTileProps {
  loading?: boolean
}

export const OrdersTile = ({ loading }: OrdersTileProps) => {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

  const startDate = useMemo(() => subMonths(new Date(), 1), [])
  const endDate = useMemo(() => new Date(), [])

  const metrics = useMetrics(organization?.id, startDate, endDate, {
    interval: 'day',
  })

  const cumulativeOrdersData = useMemo(() => {
    return (
      metrics.data?.periods.reduce<{ value: number; index: number }[]>(
        (acc, period, index) => [
          ...acc,
          {
            value: (acc[acc.length - 1]?.value ?? 0) + (period.orders ?? 0),
            index,
          },
        ],
        [],
      ) ?? []
    )
  }, [metrics])

  const maxValue = useMemo(() => {
    if (cumulativeOrdersData.length === 0) return 1
    return Math.max(...cumulativeOrdersData.map((d) => d.value), 1)
  }, [cumulativeOrdersData])

  const lineProgress = useSharedValue(0)

  useEffect(() => {
    if (cumulativeOrdersData.length > 0) {
      lineProgress.value = 0
      lineProgress.value = withDelay(500, withTiming(1, { duration: 800 }))
    }
  }, [cumulativeOrdersData.length, lineProgress])

  return (
    <Tile href="/orders">
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
            <Text variant="body" color="subtext">
              Orders
            </Text>
          </Box>
          <Text variant="body">30 Days</Text>
        </Box>
        {cumulativeOrdersData.length > 0 ? (
          <Box flex={1} flexGrow={1} width="100%">
            <CartesianChart
              data={cumulativeOrdersData}
              xKey="index"
              yKeys={['value']}
              domain={{ y: [0, maxValue] }}
              domainPadding={{ bottom: 4, top: 4 }}
              axisOptions={{
                lineColor: 'transparent',
                labelColor: 'transparent',
              }}
              frame={{ lineColor: 'transparent' }}
            >
              {({ points }) => (
                <Line
                  points={points.value}
                  color={theme.colors.statusGreen}
                  strokeWidth={2}
                  curveType="monotoneX"
                  end={lineProgress}
                />
              )}
            </CartesianChart>
          </Box>
        ) : null}
        <Text
          variant="headline"
          numberOfLines={1}
          loading={loading}
          placeholderText="123"
        >
          {metrics.data?.totals.orders ?? 0}
        </Text>
      </Box>
    </Tile>
  )
}
