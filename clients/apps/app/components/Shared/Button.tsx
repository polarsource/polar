import { useTheme } from '@/hooks/theme'
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
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
  const { colors } = useTheme()

  const getTouchableColor = () => {
    switch (variant) {
      case 'primary':
        return colors.monochromeInverted
      case 'secondary':
        return colors.card
      case 'destructive':
        return colors.errorSubtle
    }
  }

  const getTextColor = () => {
    if (disabled) {
      return colors.subtext
    }

    switch (variant) {
      case 'primary':
        return colors.monochrome
      case 'secondary':
        return colors.monochromeInverted
      case 'destructive':
        return colors.error
    }
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      style={[
        styles.button,
        {
          backgroundColor:
            disabled || loading ? '#ffffff11' : getTouchableColor(),
        },
        {
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          {
            color: getTextColor(),
          },
          textStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.monochrome} />
        ) : (
          children
        )}
      </ThemedText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    padding: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
})
