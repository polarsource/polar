import { useTheme } from '@/design-system/useTheme'
import * as Haptics from 'expo-haptics'
import { FC, ReactNode, useEffect } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const BUTTON_SCALE_DURATION = 150
const BUTTON_SCALE_PRESSED = 0.9

interface TabButtonProps {
  focused: boolean
  onPress: () => void
  children: ReactNode
}

export const TabButton: FC<TabButtonProps> = ({
  focused,
  onPress,
  children,
}) => {
  const theme = useTheme()
  const scale = useSharedValue(1)
  const bgOpacity = useSharedValue(focused ? 1 : 0)
  const isPressed = useSharedValue(false)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(scale.get(), { duration: BUTTON_SCALE_DURATION }) },
    ],
    backgroundColor:
      bgOpacity.get() > 0
        ? `rgba(255, 255, 255, ${bgOpacity.get() * 0.15})`
        : 'transparent',
  }))

  useEffect(() => {
    bgOpacity.set(
      withTiming(focused ? 1 : 0, { duration: BUTTON_SCALE_DURATION }),
    )
  }, [focused, bgOpacity])

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
        onPress()
      }}
      onPressIn={() => {
        scale.set(BUTTON_SCALE_PRESSED)
        isPressed.set(true)
        if (!focused) {
          bgOpacity.set(0.5)
        }
      }}
      onPressOut={() => {
        scale.set(1)
        isPressed.set(false)
      }}
    >
      <Animated.View
        style={[
          {
            padding: theme.spacing['spacing-12'],
            borderRadius: theme.borderRadii['border-radius-999'],
          },
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}
