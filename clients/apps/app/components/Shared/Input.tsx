import { useTheme } from '@/design-system/useTheme'
import { StyleSheet, TextInput, TextInputProps } from 'react-native'

export const Input = (props: TextInputProps) => {
  const theme = useTheme()

  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.subtext}
      keyboardAppearance="dark"
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.card,
          color: theme.colors.text,
          borderColor: theme.colors.border,
        },
        props.style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
  },
})
