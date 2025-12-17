import { NotificationBadge } from '@/components/Notifications/NotificationBadge'
import { Box } from '@/components/Shared/Box'
import PolarLogo from '@/components/Shared/PolarLogo'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useHomeHeaderHeight } from '@/hooks/useHomeHeaderHeight'
import { useAnimatedScroll } from '@/providers/AnimatedScrollProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Link } from 'expo-router'
import React, { FC } from 'react'
import { Platform } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const DURATION = 150

export const AnimatedHeader: FC = () => {
  const { netHeaderHeight } = useHomeHeaderHeight()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const {
    offsetY,
    velocityOnEndDrag,
    headerTop,
    isHeaderVisible,
    scrollDirection,
    offsetYAnchorOnBeginDrag,
  } = useAnimatedScroll()

  const headerOpacity = useSharedValue(1)
  const skipTopInterpolation = useSharedValue(false)

  const isTopOfList = useDerivedValue(() => offsetY.value < netHeaderHeight * 3)
  const isVelocityHigh = useDerivedValue(
    () => Math.abs(velocityOnEndDrag.value) > 1.25,
  )

  const rPositionContainer = useAnimatedStyle(() => {
    if (offsetY.get() <= 0 && skipTopInterpolation.get()) {
      skipTopInterpolation.set(false)
    }

    if (isTopOfList.get() && !skipTopInterpolation.get()) {
      headerTop.set(
        interpolate(
          offsetY.value,
          [0, netHeaderHeight],
          [0, -netHeaderHeight],
          Extrapolation.CLAMP,
        ),
      )
    }

    if (!isTopOfList.get()) {
      if (
        !isHeaderVisible.get() &&
        isVelocityHigh.get() &&
        scrollDirection.get() === 'to-top'
      ) {
        headerTop.set(withTiming(0, { duration: DURATION }))
        skipTopInterpolation.set(true)
      }

      if (isHeaderVisible.get() && !isVelocityHigh.get()) {
        headerTop.set(
          interpolate(
            offsetY.value,
            [
              offsetYAnchorOnBeginDrag.get(),
              offsetYAnchorOnBeginDrag.get() + netHeaderHeight,
            ],
            [0, -netHeaderHeight],
            Extrapolation.CLAMP,
          ),
        )
      }
    }

    return {
      top: headerTop.value,
    }
  })

  const rOpacityContainer = useAnimatedStyle(() => {
    if (isTopOfList.get() && !skipTopInterpolation.get()) {
      headerOpacity.set(
        interpolate(
          offsetY.value,
          [0, netHeaderHeight * 0.75],
          [1, 0],
          Extrapolation.CLAMP,
        ),
      )
    }

    if (!isTopOfList.get()) {
      if (
        !isHeaderVisible.get() &&
        isVelocityHigh.get() &&
        scrollDirection.get() === 'to-top'
      ) {
        headerOpacity.set(withTiming(1, { duration: DURATION }))
      }

      if (isHeaderVisible.get() && !isVelocityHigh.get()) {
        headerOpacity.set(
          interpolate(
            offsetY.value,
            [
              offsetYAnchorOnBeginDrag.get(),
              offsetYAnchorOnBeginDrag.get() + netHeaderHeight,
            ],
            [1, 0],
            Extrapolation.CLAMP,
          ),
        )
      }
    }

    return {
      opacity: headerOpacity.value,
    }
  })

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          backgroundColor: theme.colors['background-regular'],
          zIndex: 50,
          paddingTop: Platform.select({
            ios: insets.top,
            android: insets.top + theme.spacing['spacing-12'],
          }),
        },
        rPositionContainer,
      ]}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: netHeaderHeight,
            paddingHorizontal: theme.spacing['spacing-16'],
            paddingBottom: theme.spacing['spacing-12'],
          },
          rOpacityContainer,
        ]}
      >
        <PolarLogo size={36} />
        <Box flexDirection="row" gap="spacing-20">
          <NotificationBadge />
          <Link href="/settings" asChild>
            <Touchable hitSlop={16}>
              <MaterialIcons
                name="tune"
                size={24}
                color={theme.colors['foreground-regular']}
              />
            </Touchable>
          </Link>
        </Box>
      </Animated.View>
    </Animated.View>
  )
}
