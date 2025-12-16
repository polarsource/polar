import { useTheme } from '@/design-system/useTheme'
import { Switch as RNSwitch } from 'react-native'

export interface SwitchProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

export const Switch = ({ value, onValueChange, disabled }: SwitchProps) => {
  const theme = useTheme()

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{
        false: theme.colors.border,
        true: theme.colors.primary,
      }}
      thumbColor={theme.colors.monochromeInverted}
      ios_backgroundColor={theme.colors.border}
    />
  )
}
