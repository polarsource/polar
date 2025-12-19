import { ColorToken } from '@/design-system/theme'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect } from 'react'
import { Pressable } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Box } from './Box'
import { Text } from './Text'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

interface ToastProps {
  message: string
  type: ToastType
  persistent: boolean
  visible: boolean
  onDismiss: () => void
  bottomOffset?: number
}

const SWIPE_THRESHOLD = 50

const springConfig = {
  damping: 60,
  stiffness: 600,
}

interface TypeConfig {
  backgroundColor: string
  iconColor: string
  textColorKey: ColorToken
}

const getTypeConfig = (
  type: ToastType,
  colors: ReturnType<typeof useTheme>['colors'],
): TypeConfig => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: colors.statusGreen,
        iconColor: colors.monochrome,
        textColorKey: 'monochrome',
      }
    case 'error':
      return {
        backgroundColor: colors.statusRed,
        iconColor: colors.monochrome,
        textColorKey: 'monochrome',
      }
    case 'warning':
      return {
        backgroundColor: colors.statusYellow,
        iconColor: colors.monochrome,
        textColorKey: 'monochrome',
      }
    case 'info':
    default:
      return {
        backgroundColor: colors.card,
        iconColor: colors.text,
        textColorKey: 'text',
      }
  }
}

export const Toast = ({
  message,
  type,
  persistent,
  visible,
  onDismiss,
  bottomOffset = 0,
}: ToastProps) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const typeConfig = getTypeConfig(type, theme.colors)

  const translateY = useSharedValue(100)
  const opacity = useSharedValue(0)
  const gestureTranslateY = useSharedValue(0)

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springConfig)
      opacity.value = withTiming(1, { duration: 200 })
    } else {
      translateY.value = withSpring(100, springConfig)
      opacity.value = withTiming(0, { duration: 150 })
    }
  }, [visible, translateY, opacity])

  const dismiss = useCallback(() => {
    triggerHaptic()
    onDismiss()
  }, [onDismiss, triggerHaptic])

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        gestureTranslateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_THRESHOLD || e.velocityY > 500) {
        runOnJS(dismiss)()
      }
      gestureTranslateY.value = withSpring(0, springConfig)
    })

  const animatedStyle = useAnimatedStyle(() => {
    const totalTranslateY = translateY.value + gestureTranslateY.value
    const gestureOpacity = interpolate(
      gestureTranslateY.value,
      [0, SWIPE_THRESHOLD],
      [1, 0.5],
    )

    return {
      transform: [{ translateY: totalTranslateY }],
      opacity: opacity.value * gestureOpacity,
    }
  })

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: bottomOffset + insets.bottom + theme.spacing['spacing-16'],
            alignItems: 'center',
            zIndex: 9999,
          },
          animatedStyle,
        ]}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          paddingHorizontal="spacing-32"
          paddingVertical="spacing-12"
          borderRadius="border-radius-999"
          gap="spacing-12"
          style={{
            maxWidth: '90%',
            backgroundColor: typeConfig.backgroundColor,
            shadowColor: theme.colors.monochrome,
            shadowOffset: { width: 0, height: theme.dimension['dimension-4'] },
            shadowOpacity: 0.3,
            shadowRadius: theme.spacing['spacing-8'],
            elevation: 8,
          }}
        >
          <Text
            variant="body"
            color={typeConfig.textColorKey}
            numberOfLines={2}
          >
            {message}
          </Text>
          {persistent ? (
            <Pressable onPress={dismiss} hitSlop={8}>
              <MaterialIcons
                name="close"
                size={20}
                color={theme.colors[typeConfig.textColorKey]}
              />
            </Pressable>
          ) : null}
        </Box>
      </Animated.View>
    </GestureDetector>
  )
}
