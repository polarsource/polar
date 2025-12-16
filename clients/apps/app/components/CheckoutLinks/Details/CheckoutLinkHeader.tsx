import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

interface CheckoutLinkHeaderProps {
  label: string | null
  productLabel: string
}

export const CheckoutLinkHeader = ({
  label,
  productLabel,
}: CheckoutLinkHeaderProps) => {
  const theme = useTheme()

  return (
    <Box flexDirection="row" alignItems="center" gap="spacing-12">
      <Box
        width={48}
        height={48}
        borderRadius="border-radius-full"
        justifyContent="center"
        alignItems="center"
        backgroundColor="card"
      >
        <MaterialIcons name="link" size={24} color={theme.colors.text} />
      </Box>
      <Box flex={1} flexDirection="column" gap="spacing-4">
        <Text variant="title">{label || 'Untitled'}</Text>
        <Text variant="body" color="subtext">
          {productLabel}
        </Text>
      </Box>
    </Box>
  )
}
