import { useTheme } from '@/hooks/theme'
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native'
import { ThemedText } from './ThemedText'

interface MiniButtonProps extends TouchableOpacityProps {
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'destructive'
}

export const MiniButton = ({
  children,
  onPress,
  style,
  icon,
  disabled,
  variant = 'primary',
  ...props
}: MiniButtonProps) => {
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
      activeOpacity={0.6}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.secondary : getTouchableColor(),
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
      <ThemedText
        style={{ fontSize: 14, fontWeight: '500', color: getTextColor() }}
      >
        {children}
      </ThemedText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 'auto',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
})
