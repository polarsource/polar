import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useCumulativeRevenue } from '@/hooks/useCumulativeRevenue'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrency } from '@polar-sh/currency'
import { Group, LinearGradient, vec } from '@shopify/react-native-skia'
import { useContext, useEffect } from 'react'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Area, CartesianChart, Line } from 'victory-native'
import { Avatar } from '../Shared/Avatar'
import { Text } from '../Shared/Text'

export interface RevenueStageProps {
  paddingTop: number
  foldProgress: number
}

export const RevenueStage = ({
  paddingTop,
  foldProgress,
}: RevenueStageProps) => {
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const { data, maxValue, total } = useCumulativeRevenue()

  const fold = useSharedValue(foldProgress)

  useEffect(() => {
    fold.set(withTiming(foldProgress, { duration: 120 }))
  }, [fold, foldProgress])

  const totalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(fold.get(), [0, 1], [0.6, 1]) },
      { translateY: interpolate(fold.get(), [0, 1], [24, 0]) },
    ],
  }))

  return (
    <Box flex={1} style={{ paddingTop }}>
      {data.length > 0 ? (
        <Box
          style={{
            position: 'absolute',
            top: paddingTop,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <CartesianChart
            data={data}
            xKey="index"
            yKeys={['value']}
            domain={{ y: [0, maxValue * 1.15] }}
            padding={0}
            axisOptions={{
              lineColor: 'transparent',
              labelColor: 'transparent',
            }}
            frame={{ lineColor: 'transparent' }}
          >
            {({ points, chartBounds }) => (
              <>
                <Group opacity={fold}>
                  <Area
                    points={points.value}
                    y0={chartBounds.bottom}
                    curveType="monotoneX"
                  >
                    <LinearGradient
                      start={vec(0, chartBounds.top)}
                      end={vec(0, chartBounds.bottom)}
                      colors={[
                        `${theme.colors.primary}55`,
                        `${theme.colors.primary}00`,
                      ]}
                    />
                  </Area>
                </Group>
                <Line
                  points={points.value}
                  color={theme.colors.primary}
                  strokeWidth={4}
                  curveType="monotoneX"
                  end={fold}
                />
              </>
            )}
          </CartesianChart>
        </Box>
      ) : null}
      <Box
        flex={1}
        flexDirection="column"
        justifyContent="space-between"
        padding="spacing-24"
      >
        <Box flexDirection="row" alignItems="center" gap="spacing-12">
          {organization ? (
            <Avatar
              name={organization.name}
              image={organization.avatar_url}
              size={28}
              backgroundColor={
                organization.avatar_url ? undefined : theme.colors.primary
              }
            />
          ) : null}
          <Text variant="subtitle" style={{ fontWeight: '600' }}>
            {organization?.name}
          </Text>
        </Box>
        <Box flexDirection="column" gap="spacing-4">
          <Text variant="body" color="subtext">
            Revenue · Last 30 days
          </Text>
          <Animated.View
            style={[
              { alignSelf: 'flex-start', transformOrigin: 'left bottom' },
              totalStyle,
            ]}
          >
            <Text
              variant="display"
              numberOfLines={1}
              style={{ fontSize: 64, lineHeight: 72 }}
            >
              {formatCurrency('statistics')(total, 'usd')}
            </Text>
          </Animated.View>
        </Box>
      </Box>
    </Box>
  )
}
