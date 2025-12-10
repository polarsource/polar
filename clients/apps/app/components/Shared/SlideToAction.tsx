import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleProp,
  ViewStyle,
} from 'react-native'

interface SlideToActionProps {
  onSlideComplete: () => void
  text?: string
  releaseText?: string
  style?: StyleProp<ViewStyle>
  isLoading?: boolean
  disabled?: boolean
  onSlideStart?: () => void
  onSlideEnd?: () => void
}

export const SlideToAction = ({
  onSlideComplete,
  text = 'Slide to confirm',
  releaseText = 'Release To Confirm',
  style,
  disabled = false,
  isLoading = false,
  onSlideStart,
  onSlideEnd,
}: SlideToActionProps) => {
  const theme = useTheme()

  const [label, setLabel] = useState(text)
  const [sliderWidth, setSliderWidth] = useState(0)
  const [thumbWidth, setThumbWidth] = useState(0)
  const slideAnimation = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current

  const maxSlide = useMemo(() => {
    return Math.max(0, sliderWidth - thumbWidth - 16)
  }, [sliderWidth, thumbWidth])

  const handleLayoutSlider = useCallback((event: any) => {
    setSliderWidth(event.nativeEvent.layout.width)
  }, [])

  const handleLayoutThumb = useCallback((event: any) => {
    setThumbWidth(event.nativeEvent.layout.width)
  }, [])

  const resetPosition = useCallback(() => {
    Animated.spring(slideAnimation, {
      toValue: 0,
      useNativeDriver: true,
    }).start()
  }, [slideAnimation])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderMove: (event, gestureState) => {
          const newPosition = Math.max(0, Math.min(gestureState.dx, maxSlide))
          slideAnimation.setValue({ x: newPosition, y: 0 })
        },
        onPanResponderStart: (e) => {
          onSlideStart?.()
        },
        onPanResponderEnd: (e) => {
          onSlideEnd?.()
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= maxSlide * 0.9) {
            Animated.spring(slideAnimation, {
              toValue: maxSlide,
              useNativeDriver: true,
            }).start(() => {
              onSlideComplete()
              resetPosition()
            })
          } else {
            resetPosition()
          }
        },
      }),
    [disabled, maxSlide, resetPosition, onSlideComplete],
  )

  const interpolatedBackgroundColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [theme.colors.card, theme.colors.monochromeInverted],
    extrapolate: 'clamp',
  })

  const interpolatedThumbBackgroundColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [theme.colors.secondary, theme.colors.primary],
    extrapolate: 'clamp',
  })

  const interpolatedTextColor = slideAnimation.x.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [theme.colors.monochromeInverted, theme.colors.monochrome],
    extrapolate: 'clamp',
  })

  useEffect(() => {
    const listener = slideAnimation.addListener(({ x }) => {
      if (x >= maxSlide) {
        setLabel(releaseText)
      } else {
        setLabel(text)
      }
    })

    return () => slideAnimation.removeListener(listener)
  }, [slideAnimation, maxSlide, text, releaseText])

  return (
    <Animated.View
      style={[
        {
          height: 80,
          width: '100%',
          borderRadius: theme.borderRadii['border-radius-full'],
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: interpolatedBackgroundColor,
        },
        disabled && { opacity: 0.5 },
        style,
      ]}
      onLayout={handleLayoutSlider}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.monochromeInverted}
        />
      ) : (
        <Animated.Text style={{ fontSize: 16, color: interpolatedTextColor }}>
          {label}
        </Animated.Text>
      )}
      <Animated.View
        style={{
          position: 'absolute',
          height: 64,
          width: 64,
          left: 8,
          top: 8,
          borderRadius: theme.borderRadii['border-radius-full'],
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ translateX: slideAnimation.x }],
          backgroundColor: interpolatedThumbBackgroundColor,
        }}
        onLayout={handleLayoutThumb}
        {...panResponder.panHandlers}
      >
        <MaterialIcons
          name="arrow-forward-ios"
          size={16}
          color={theme.colors.monochromeInverted}
        />
      </Animated.View>
    </Animated.View>
  )
}
