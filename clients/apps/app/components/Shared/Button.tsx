import { ActivityIndicator } from 'react-native'

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

export type ButtonSize = 'small' | 'medium'

type SizeConfig = {
  height?: DimensionToken
  paddingHorizontal: SpacingToken
  paddingVertical: SpacingToken
  textVariant: TextVariantKey
}

const buttonSizes: Record<ButtonSize, SizeConfig> = {
  small: {
    paddingHorizontal: 'spacing-12',
    paddingVertical: 'spacing-6',
    textVariant: 'bodySmall',
  },
  medium: {
    height: 'dimension-50',
    paddingHorizontal: 'spacing-16',
    paddingVertical: 'spacing-10',
    textVariant: 'bodyMedium',
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

  return (
    <Touchable onPress={onPress} disabled={disabled || loading}>
      <Box
        paddingHorizontal={sizeStyle.paddingHorizontal}
        paddingVertical={sizeStyle.paddingVertical}
        borderRadius="border-radius-999"
        alignItems="center"
        justifyContent="center"
        flexDirection="row"
        style={
          sizeStyle.height
            ? { height: theme.dimension[sizeStyle.height] }
            : undefined
        }
        opacity={disabled ? 0.7 : 1}
        backgroundColor={backgroundColor}
        width={fullWidth ? '100%' : undefined}
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
