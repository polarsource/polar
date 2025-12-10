import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { Text } from './Text'

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
      <Text color="subtext" style={labelStyle}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        color={value ? 'text' : 'subtext'}
        textAlign="right"
        style={valueStyle}
      >
        {value ? value : '—'}
      </Text>
    </Box>
  )
}
