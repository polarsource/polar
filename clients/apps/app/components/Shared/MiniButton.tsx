import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
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
      activeOpacity={0.6}
      style={[
        styles.button,
        {
          backgroundColor: disabled
            ? theme.colors.secondary
            : getTouchableColor(),
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      {icon && <Box marginRight="spacing-4">{icon}</Box>}
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
