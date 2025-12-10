import { useTheme } from '@/design-system/useTheme'
import {
  ActivityIndicator,
  StyleProp,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native'
import { ThemedText } from './ThemedText'

export interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'destructive'
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export const Button = ({
  children,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  variant = 'primary',
}: ButtonProps) => {
  const theme = useTheme()

  const getTouchableColor = () => {
    switch (variant) {
      case 'primary':
        return theme.colors.monochromeInverted
      case 'secondary':
        return theme.colors.card
      case 'destructive':
        return theme.colors.errorSubtle
    }
  }

  const getTextColor = () => {
    if (disabled) {
      return theme.colors.subtext
    }

    switch (variant) {
      case 'primary':
        return theme.colors.monochrome
      case 'secondary':
        return theme.colors.monochromeInverted
      case 'destructive':
        return theme.colors.error
    }
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      style={[
        {
          padding: theme.spacing['spacing-10'],
          borderRadius: theme.borderRadii['border-radius-999'],
          alignItems: 'center',
          justifyContent: 'center',
          height: 50,
          backgroundColor:
            disabled || loading ? theme.colors.disabled : getTouchableColor(),
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      <ThemedText
        style={[
          {
            fontSize: 16,
            fontWeight: '500',
            color: getTextColor(),
          },
          textStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.monochrome} />
        ) : (
          children
        )}
      </ThemedText>
    </TouchableOpacity>
  )
}
