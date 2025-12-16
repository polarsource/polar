import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

interface DiscountFieldProps {
  discountId: string | null
  discountName: string | null
  onPress: () => void
}

export const DiscountField = ({
  discountId,
  discountName,
  onPress,
}: DiscountFieldProps) => {
  const theme = useTheme()

  return (
    <Box flexDirection="column" gap="spacing-8">
      <Text variant="bodyMedium" color="subtext">
        Preset Discount
      </Text>
      <Touchable onPress={onPress}>
        <Box
          flexDirection="row"
          alignItems="center"
          padding="spacing-16"
          backgroundColor="card"
          borderRadius="border-radius-12"
          gap="spacing-12"
        >
          <Box flex={1}>
            <Text variant="body" color={discountId ? 'text' : 'subtext'}>
              {discountName ?? 'No discount applied'}
            </Text>
          </Box>
          <MaterialIcons
            name="expand-more"
            size={20}
            color={theme.colors.subtext}
          />
        </Box>
      </Touchable>
    </Box>
  )
}
