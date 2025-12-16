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

export interface SubscriptionsTileProps {
  loading?: boolean
}

export const SubscriptionsTile = ({ loading }: SubscriptionsTileProps) => {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

  const startDate = useMemo(() => subMonths(new Date(), 1), [])
  const endDate = useMemo(() => new Date(), [])

  const metrics = useMetrics(organization?.id, startDate, endDate, {
    interval: 'day',
  })

  const activeSubsData = useMemo(() => {
    return (
      metrics.data?.periods.map((period, index) => ({
        value: period.active_subscriptions ?? 0,
        index,
      })) ?? []
    )
  }, [metrics])

  const maxValue = useMemo(() => {
    if (activeSubsData.length === 0) return 1
    return Math.max(...activeSubsData.map((d) => d.value), 1)
  }, [activeSubsData])

  const minValue = useMemo(() => {
    if (activeSubsData.length === 0) return 0
    return Math.min(...activeSubsData.map((d) => d.value))
  }, [activeSubsData])

  const lineProgress = useSharedValue(0)

  useEffect(() => {
    if (activeSubsData.length > 0) {
      lineProgress.value = 0
      lineProgress.value = withDelay(500, withTiming(1, { duration: 800 }))
    }
  }, [activeSubsData.length, lineProgress])

  const currentActiveSubscriptions =
    activeSubsData[activeSubsData.length - 1]?.value ?? 0

  return (
    <Tile href="/subscriptions">
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
              Subscriptions
            </Text>
          </Box>
          <Text variant="body">Active</Text>
        </Box>
        {activeSubsData.length > 0 ? (
          <Box flex={1} flexGrow={1} width="100%">
            <CartesianChart
              data={activeSubsData}
              xKey="index"
              yKeys={['value']}
              domain={{ y: [minValue, maxValue] }}
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
                  color={theme.colors.primary}
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
          {currentActiveSubscriptions}
        </Text>
      </Box>
    </Tile>
  )
}
