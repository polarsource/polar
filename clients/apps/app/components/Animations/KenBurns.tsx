import { PropsWithChildren, useEffect } from 'react'
import { ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

interface Props extends PropsWithChildren {
  style?: ViewStyle
  duration?: number
  maxScale?: number
  trigger?: number
  fadeInDuration?: number
}

export function KenBurns({
  children,
  style,
  duration = 20000,
  maxScale = 1.08,
  trigger = 0,
  fadeInDuration = 1200,
}: Props) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = 0
    opacity.value = withTiming(1, {
      duration: fadeInDuration,
      easing: Easing.out(Easing.ease),
    })

    scale.value = 1
    scale.value = withRepeat(
      withSequence(
        withTiming(maxScale, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    )
  }, [scale, opacity, duration, maxScale, trigger, fadeInDuration])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  )
}
