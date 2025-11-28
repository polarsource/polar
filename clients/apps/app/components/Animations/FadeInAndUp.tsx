import { PropsWithChildren, useEffect } from 'react'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated'

interface Props extends PropsWithChildren {
  delay?: number
  withSpringProps?: WithSpringConfig
  trigger?: number
}

export function FadeInAndUp({
  children,
  delay = 0,
  withSpringProps = { stiffness: 200, damping: 120, mass: 4 },
  trigger = 0,
}: Props) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = 0
    progress.value = withDelay(delay, withSpring(1, withSpringProps))
  }, [delay, progress, withSpringProps, trigger])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [20, 0]) }],
  }))

  return <Animated.View style={animatedStyle}>{children}</Animated.View>
}
