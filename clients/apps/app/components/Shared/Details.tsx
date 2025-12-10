import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { StyleProp, Text, TextStyle, ViewStyle } from 'react-native'
import { ThemedText } from './ThemedText'

export const Details = ({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) => {
  return (
    <Box
      backgroundColor="card"
      padding="spacing-16"
      borderRadius="border-radius-12"
      gap="spacing-8"
      style={style}
    >
      {children}
    </Box>
  )
}

export const DetailRow = ({
  label,
  labelStyle,
  value,
  valueStyle,
}: {
  label: string
  labelStyle?: StyleProp<TextStyle>
  value?: React.ReactNode
  valueStyle?: StyleProp<TextStyle>
}) => {
  const theme = useTheme()

  return (
    <Box flexDirection="row" justifyContent="space-between" gap="spacing-8">
      <ThemedText style={[{ fontSize: 16 }, labelStyle]} secondary>
        {label}
      </ThemedText>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          {
            fontSize: 16,
            width: 'auto',
            textAlign: 'right',
            color: value ? theme.colors.text : theme.colors.subtext,
          },
          valueStyle,
        ]}
      >
        {value ? value : '—'}
      </Text>
    </Box>
  )
}
