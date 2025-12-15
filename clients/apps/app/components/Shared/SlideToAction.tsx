import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Haptics from 'expo-haptics'
import { useCallback, useState } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface SlideToActionProps {
  onSlideComplete: () => Promise<void> | void
  onFinish?: () => void
  text?: string
  releaseText?: string
  successText?: string
  loadingText?: string
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  onSlideStart?: () => void
  onSlideEnd?: () => void
}

const SLIDER_HEIGHT = 80
const THUMB_SIZE = 64
const THUMB_PADDING = 8
const COMPLETION_THRESHOLD = 0.9
const MIN_LOADING_MS = 2000
const SUCCESS_DISPLAY_MS = 2000

const springConfig = {
  damping: 50,
  stiffness: 400,
}

type Phase = 'idle' | 'loading' | 'success'

export const SlideToAction = ({
  onSlideComplete,
  onFinish,
  text = 'Slide to confirm',
  releaseText = 'Release to confirm',
  successText = 'Success!',
  loadingText = 'Processing...',
  style,
  disabled = false,
  onSlideStart,
  onSlideEnd,
}: SlideToActionProps) => {
  const theme = useTheme()

  const [sliderWidth, setSliderWidth] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')

  const progress = useSharedValue(0)
  const atThreshold = useSharedValue(false)
  const loadingProgress = useSharedValue(0)
  const successProgress = useSharedValue(0)

  const maxSlide = Math.max(0, sliderWidth - THUMB_SIZE - THUMB_PADDING * 2)

  const hapticLight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const hapticHeavy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }, [])

  const hapticMedium = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [])

  const startLoading = useCallback(() => {
    setPhase('loading')
  }, [])

  const startSuccess = useCallback(() => {
    setPhase('success')
  }, [])

  const handleComplete = useCallback(async () => {
    const startTime = Date.now()

    await onSlideComplete()

    const elapsed = Date.now() - startTime
    const remaining = MIN_LOADING_MS - elapsed
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
    }
  }, [onSlideComplete])

  useAnimatedReaction(
    () => progress.value >= COMPLETION_THRESHOLD,
    (isAtThreshold, prev) => {
      if (isAtThreshold !== prev) {
        atThreshold.value = isAtThreshold
        if (isAtThreshold) {
          runOnJS(hapticHeavy)()
        }
      }
    },
    [],
  )

  const handleStart = useCallback(() => {
    onSlideStart?.()
  }, [onSlideStart])

  const handleEnd = useCallback(() => {
    onSlideEnd?.()
  }, [onSlideEnd])

  const executeAction = useCallback(async () => {
    startLoading()
    loadingProgress.value = withTiming(1, { duration: 300 })

    await handleComplete()

    hapticMedium()
    startSuccess()
    loadingProgress.value = withTiming(0, { duration: 200 })
    successProgress.value = withTiming(1, { duration: 300 })

    await new Promise((resolve) => setTimeout(resolve, SUCCESS_DISPLAY_MS))
    onFinish?.()
  }, [
    handleComplete,
    hapticMedium,
    startLoading,
    startSuccess,
    loadingProgress,
    successProgress,
    onFinish,
  ])

  const panGesture = Gesture.Pan()
    .enabled(!disabled && phase === 'idle')
    .onStart(() => {
      runOnJS(handleStart)()
      runOnJS(hapticLight)()
    })
    .onUpdate((e) => {
      if (maxSlide > 0) {
        progress.value = Math.max(0, Math.min(e.translationX / maxSlide, 1))
      }
    })
    .onEnd(() => {
      runOnJS(handleEnd)()

      if (progress.value >= COMPLETION_THRESHOLD) {
        progress.value = withSpring(1, springConfig)
        runOnJS(executeAction)()
      } else {
        progress.value = withSpring(0, springConfig)
      }
    })

  const thumbStyle = useAnimatedStyle(() => {
    const translateX = progress.value * maxSlide

    const baseColor = interpolateColor(
      progress.value,
      [0, 0.9],
      [theme.colors.secondary, theme.colors.primary],
    )

    const backgroundColor =
      successProgress.value > 0
        ? interpolateColor(
            successProgress.value,
            [0, 1],
            [baseColor, theme.colors.statusGreen],
          )
        : baseColor

    return {
      transform: [{ translateX }],
      backgroundColor,
    }
  })

  const slideTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.7, 0.9], [1, 1, 0])
    const translateY = interpolate(progress.value, [0, 0.7, 0.9], [0, 0, -15])

    return {
      opacity:
        loadingProgress.value > 0 || successProgress.value > 0 ? 0 : opacity,
      transform: [{ translateY }],
    }
  })

  const releaseTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.7, 0.9], [0, 0, 1])
    const translateY = interpolate(progress.value, [0, 0.7, 0.9], [15, 15, 0])

    return {
      opacity:
        loadingProgress.value > 0 || successProgress.value > 0 ? 0 : opacity,
      transform: [{ translateY }],
    }
  })

  const loadingTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(loadingProgress.value, [0, 1], [0, 1])
    const translateY = interpolate(loadingProgress.value, [0, 1], [10, 0])

    return {
      opacity: successProgress.value > 0 ? 0 : opacity,
      transform: [{ translateY }],
    }
  })

  const successTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(successProgress.value, [0, 1], [0, 1])
    const translateY = interpolate(successProgress.value, [0, 1], [10, 0])

    return {
      opacity,
      transform: [{ translateY }],
    }
  })

  return (
    <View
      style={[
        {
          height: SLIDER_HEIGHT,
          width: '100%',
          borderRadius: SLIDER_HEIGHT / 2,
          backgroundColor: theme.colors.card,
          overflow: 'hidden',
        },
        style,
      ]}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          },
          slideTextStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: theme.colors.monochromeInverted,
          }}
        >
          {text}
        </Animated.Text>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          },
          releaseTextStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: theme.colors.monochromeInverted,
          }}
        >
          {releaseText}
        </Animated.Text>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          },
          loadingTextStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: theme.colors.monochromeInverted,
          }}
        >
          {loadingText}
        </Animated.Text>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          },
          successTextStyle,
        ]}
        pointerEvents="none"
      >
        <Animated.Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.statusGreen,
          }}
        >
          {successText}
        </Animated.Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              height: THUMB_SIZE,
              width: THUMB_SIZE,
              left: THUMB_PADDING,
              top: THUMB_PADDING,
              borderRadius: THUMB_SIZE / 2,
              justifyContent: 'center',
              alignItems: 'center',
            },
            thumbStyle,
          ]}
        >
          <MaterialIcons
            name={phase === 'success' ? 'check' : 'arrow-forward-ios'}
            size={phase === 'success' ? 24 : 18}
            color={theme.colors.monochromeInverted}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
