import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { StyleProp, TextStyle, ViewStyle } from 'react-native'

type PillColor = 'green' | 'yellow' | 'red' | 'blue'

const getColorTokens = (color: PillColor) => {
  switch (color) {
    case 'green':
      return { text: 'statusGreen', bg: 'statusGreenBg' } as const
    case 'yellow':
      return { text: 'statusYellow', bg: 'statusYellowBg' } as const
    case 'red':
      return { text: 'statusRed', bg: 'statusRedBg' } as const
    case 'blue':
      return { text: 'statusBlue', bg: 'statusBlueBg' } as const
  }
}

export const Pill = ({
  color,
  children,
  style,
  textStyle,
  loading,
}: {
  color: PillColor
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  loading?: boolean
}) => {
  const theme = useTheme()
  const colorTokens = getColorTokens(color)

  return (
    <Box
      paddingHorizontal="spacing-6"
      paddingVertical="spacing-4"
      borderRadius="border-radius-6"
      style={[{ backgroundColor: theme.colors[colorTokens.bg] }, style]}
    >
      <Text
        variant="caption"
        textTransform="capitalize"
        loading={loading}
        placeholderText={color}
        placeholderColor={colorTokens.bg}
        style={[
          {
            color: theme.colors[colorTokens.text],
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </Box>
  )
}
