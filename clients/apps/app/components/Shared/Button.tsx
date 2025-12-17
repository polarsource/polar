import { ActivityIndicator, Pressable, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { Text } from '@/components/Shared/Text'
import {
  ButtonVariantKey,
  buttonVariants,
} from '@/design-system/buttonVariants'
import { TextVariantKey } from '@/design-system/textVariants'
import { DimensionToken, SpacingToken } from '@/design-system/theme'
import { useTheme } from '@/design-system/useTheme'
import { Box } from './Box'
import { Touchable } from './Touchable'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Collapsed width for loading state - just enough for the spinner
const COLLAPSED_WIDTH_SMALL = 36
const COLLAPSED_WIDTH_MEDIUM = 50

export type ButtonSize = 'small' | 'medium'

type SizeConfig = {
  height?: DimensionToken
  paddingHorizontal: SpacingToken
  paddingVertical: SpacingToken
  textVariant: TextVariantKey
  collapsedWidth: number
}

const buttonSizes: Record<ButtonSize, SizeConfig> = {
  small: {
    paddingHorizontal: 'spacing-12',
    paddingVertical: 'spacing-6',
    textVariant: 'bodySmall',
    collapsedWidth: COLLAPSED_WIDTH_SMALL,
  },
  medium: {
    height: 'dimension-50',
    paddingHorizontal: 'spacing-16',
    paddingVertical: 'spacing-10',
    textVariant: 'bodyMedium',
    collapsedWidth: COLLAPSED_WIDTH_MEDIUM,
  },
}

export type ButtonProps = {
  onPress?: () => void
  children: React.ReactNode
  variant?: ButtonVariantKey
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
}

export const Button = ({
  onPress,
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
}: ButtonProps) => {
  const theme = useTheme()
  const variantStyle = buttonVariants[variant]
  const sizeStyle = buttonSizes[size]

  const backgroundColor = disabled
    ? variantStyle.disabledBackgroundColor
    : variantStyle.backgroundColor

  const textColorToken = disabled
    ? variantStyle.disabledTextColor
    : variantStyle.textColor

  const height = sizeStyle.height
    ? theme.dimension[sizeStyle.height]
    : undefined

  // For fullWidth buttons, use the collapsing animation
  if (fullWidth) {
    return (
      // eslint-disable-next-line @polar/no-view
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <AnimatedPressable
          onPress={onPress}
          disabled={disabled || loading}
          style={{
            height,
            paddingHorizontal: loading
              ? 0
              : theme.spacing[sizeStyle.paddingHorizontal],
            paddingVertical: theme.spacing[sizeStyle.paddingVertical],
            borderRadius: theme.borderRadii['border-radius-999'],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors[backgroundColor],
            opacity: disabled ? 0.7 : 1,
            // Native style transitions for smooth width morph
            transitionProperty: 'width',
            transitionDuration: 300,
            transitionTimingFunction: 'ease-out',
            width: loading ? sizeStyle.collapsedWidth : '100%',
          }}
        />
        {/* eslint-disable-next-line @polar/no-view */}
        <View style={{ position: 'absolute', pointerEvents: 'none' }}>
          {loading ? (
            <Animated.View key="loader" entering={FadeIn}>
              <ActivityIndicator
                size="small"
                color={theme.colors[textColorToken]}
              />
            </Animated.View>
          ) : (
            <Animated.View
              key="content"
              entering={FadeIn}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              {icon ? <Box marginRight="spacing-4">{icon}</Box> : null}
              <Text variant={sizeStyle.textVariant} color={textColorToken}>
                {children}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
    )
  }

  // Non-fullWidth buttons use original implementation
  return (
    <Touchable onPress={onPress} disabled={disabled || loading}>
      <Box
        paddingHorizontal={sizeStyle.paddingHorizontal}
        paddingVertical={sizeStyle.paddingVertical}
        borderRadius="border-radius-999"
        alignItems="center"
        justifyContent="center"
        flexDirection="row"
        style={height ? { height } : undefined}
        opacity={disabled ? 0.7 : 1}
        backgroundColor={backgroundColor}
      >
        {loading ? (
          <Box marginRight="spacing-8">
            <ActivityIndicator
              size="small"
              color={theme.colors[textColorToken]}
            />
          </Box>
        ) : null}
        {icon && !loading ? <Box marginRight="spacing-4">{icon}</Box> : null}
        <Text variant={sizeStyle.textVariant} color={textColorToken}>
          {children}
        </Text>
      </Box>
    </Touchable>
  )
}
