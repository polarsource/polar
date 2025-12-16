import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

interface ProductsFieldProps {
  productNames: string[]
  productCount: number
  onPress: () => void
}

export const ProductsField = ({
  productNames,
  productCount,
  onPress,
}: ProductsFieldProps) => {
  const theme = useTheme()

  return (
    <Box flexDirection="column" gap="spacing-8">
      <Text variant="bodyMedium" color="subtext">
        Products
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
            {productCount === 0 ? (
              <Text variant="body" color="subtext">
                Select products
              </Text>
            ) : productCount === 1 ? (
              <Text variant="body">
                {productNames[0] ?? '1 product selected'}
              </Text>
            ) : (
              <Box flexDirection="column" gap="spacing-4">
                <Text variant="body">{productCount} products selected</Text>
                {productNames.length > 0 ? (
                  <Text variant="bodySmall" color="subtext" numberOfLines={1}>
                    {productNames.join(', ')}
                  </Text>
                ) : null}
              </Box>
            )}
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
