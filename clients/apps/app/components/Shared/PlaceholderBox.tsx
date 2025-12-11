import { BorderRadiiToken, ColorToken } from '@/design-system/theme'
import { useTheme } from '@/design-system/useTheme'
import { useEffect } from 'react'
import { DimensionValue, ViewStyle } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface PlaceholderBoxProps {
  width?: DimensionValue
  height?: number
  borderRadius?: BorderRadiiToken
  style?: ViewStyle
  color?: ColorToken
}

export const PlaceholderBox = ({
  width = '100%',
  height = 16,
  borderRadius = 'border-radius-4',
  style,
  color = 'secondary',
}: PlaceholderBoxProps) => {
  const theme = useTheme()
  const shimmerProgress = useSharedValue(0)

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      false,
    )
  }, [shimmerProgress])

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerProgress.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3],
    )
    return { opacity }
  })

  return (
    <Animated.View
      style={[
        { overflow: 'hidden' },
        {
          width,
          height,
          borderRadius: theme.borderRadii[borderRadius],
          backgroundColor: theme.colors[color],
        },
        animatedStyle,
        style,
      ]}
    />
  )
}
