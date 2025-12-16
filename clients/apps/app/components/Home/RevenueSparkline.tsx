import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { toValueDataPoints, useMetrics } from '@/hooks/polar/metrics'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { subDays } from 'date-fns'
import { useContext, useEffect, useMemo } from 'react'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

const AnimatedPath = Animated.createAnimatedComponent(Path)

interface RevenueSparklineProps {
  loading?: boolean
}

export const RevenueSparkline = ({ loading }: RevenueSparklineProps) => {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

  const startDate = useMemo(() => subDays(new Date(), 7), [])
  const endDate = useMemo(() => new Date(), [])

  const { data: metricsData, isLoading } = useMetrics(
    organization?.id,
    startDate,
    endDate,
    { interval: 'day' },
  )

  const dataPoints = useMemo(
    () => toValueDataPoints(metricsData, 'revenue'),
    [metricsData],
  )

  const totalRevenue = metricsData?.totals.revenue ?? 0
  const formattedRevenue = formatCurrencyAndAmount(totalRevenue, 'usd', 0)

  // Animation progress
  const progress = useSharedValue(0)

  useEffect(() => {
    if (dataPoints.length > 0) {
      progress.value = 0
      progress.value = withDelay(200, withTiming(1, { duration: 800 }))
    }
  }, [dataPoints.length, progress])

  // Chart dimensions
  const width = 120
  const height = 40

  const pathString = useMemo(() => {
    if (dataPoints.length === 0) {
      return ''
    }

    const values = dataPoints.map((p) => p.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    const range = max - min || 1

    return dataPoints
      .map((point, index) => {
        const x = (index / (dataPoints.length - 1)) * width
        const y = height - ((point.value - min) / range) * height
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [dataPoints])

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: (1 - progress.value) * 500,
    }
  })

  const showLoading = loading || isLoading

  return (
    <Box
      backgroundColor="card"
      borderRadius="border-radius-16"
      padding="spacing-16"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <Box gap="spacing-4">
        <Text variant="caption" color="subtext">
          Last 7 days
        </Text>
        <Text variant="title" loading={showLoading} placeholderText="$1,234">
          {formattedRevenue}
        </Text>
      </Box>
      {dataPoints.length > 0 ? (
        <Box width={width} height={height}>
          <Svg width={width} height={height}>
            <AnimatedPath
              d={pathString}
              stroke={theme.colors.primary}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={500}
              animatedProps={animatedProps}
            />
          </Svg>
        </Box>
      ) : null}
    </Box>
  )
}
