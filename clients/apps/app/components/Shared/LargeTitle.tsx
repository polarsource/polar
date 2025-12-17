import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { FC } from 'react'
import { Platform, StyleSheet } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ScreenHeaderProps {
  title: string
  offsetY: SharedValue<number>
  titleBottomY: SharedValue<number>
}

export const ScreenHeader: FC<ScreenHeaderProps> = ({
  title,
  offsetY,
  titleBottomY,
}) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + 44

  const rHeaderTitleOpacity = useAnimatedStyle(() => {
    if (titleBottomY.value <= 0) return { opacity: 0 }

    const scrollDistance = titleBottomY.value - headerHeight

    return {
      opacity: withTiming(offsetY.value > scrollDistance ? 1 : 0, {
        duration: 150,
      }),
    }
  })

  return (
    <Animated.View
      style={[
        styles.header,
        {
          paddingTop: Platform.select({
            ios: insets.top,
            android: insets.top + theme.spacing['spacing-12'],
          }),
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <Box
        height={44}
        justifyContent="center"
        alignItems="center"
        paddingHorizontal="spacing-16"
      >
        <Animated.View style={rHeaderTitleOpacity}>
          <Text variant="bodyMedium">{title}</Text>
        </Animated.View>
      </Box>
    </Animated.View>
  )
}

interface LargeTitleProps {
  title: string
  offsetY: SharedValue<number>
  titleBottomY: SharedValue<number>
  contentPaddingTop: number
}

export const LargeTitle: FC<LargeTitleProps> = ({
  title,
  offsetY,
  titleBottomY,
  contentPaddingTop,
}) => {
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + 44

  const rLargeTitleStyle = useAnimatedStyle(() => {
    if (titleBottomY.value <= 0) {
      return {
        opacity: 1,
        transform: [
          {
            scale: interpolate(
              offsetY.value,
              [0, -200],
              [1, 1.1],
              Extrapolation.CLAMP,
            ),
          },
        ],
      }
    }

    const scrollDistance = titleBottomY.value - headerHeight

    return {
      opacity: withTiming(offsetY.value < scrollDistance ? 1 : 0, {
        duration: 150,
      }),
      transform: [
        {
          scale: interpolate(
            offsetY.value,
            [0, -200],
            [1, 1.1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  return (
    <Animated.View
      style={[rLargeTitleStyle, { transformOrigin: 'left' }]}
      onLayout={({ nativeEvent }) =>
        titleBottomY.set(
          contentPaddingTop + nativeEvent.layout.y + nativeEvent.layout.height,
        )
      }
    >
      <Text variant="titleLarge">{title}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
})
