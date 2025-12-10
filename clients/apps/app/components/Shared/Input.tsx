import { useTheme } from '@/design-system/useTheme'
import { TextInput, TextInputProps } from 'react-native'

export const Input = (props: TextInputProps) => {
  const theme = useTheme()

  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.subtext}
      keyboardAppearance="dark"
      style={[
        {
          borderRadius: theme.borderRadii['border-radius-12'],
          borderWidth: 1,
          padding: theme.spacing['spacing-16'],
          fontSize: 16,
          backgroundColor: theme.colors.card,
          color: theme.colors.text,
          borderColor: theme.colors.border,
        },
        props.style,
      ]}
    />
  )
}
