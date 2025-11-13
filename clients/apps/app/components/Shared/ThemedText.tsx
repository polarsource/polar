import { useTheme } from '@/hooks/theme'
import { ComponentProps } from 'react'
import { StyleSheet, Text } from 'react-native'

type ThemedTextProps = ComponentProps<typeof Text> & {
  secondary?: boolean
  error?: boolean
}

export const ThemedText = ({
  secondary,
  error,
  style,
  ...props
}: ThemedTextProps) => {
  const { colors } = useTheme()

  const lineHeight = (fontSize: number) => {
    const multiplier = fontSize > 20 ? 1.5 : 1.4
    return fontSize * multiplier
  }

  const styles = StyleSheet.flatten(style)

  return (
    <Text
      {...props}
      style={[
        {
          color: error
            ? colors.error
            : secondary
              ? colors.subtext
              : colors.text,
          lineHeight: lineHeight(styles?.fontSize ?? 14),
        },
        styles,
      ]}
    />
  )
}
