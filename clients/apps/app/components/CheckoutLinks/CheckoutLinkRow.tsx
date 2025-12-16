import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'

export interface CheckoutLinkRowProps {
  checkoutLink: schemas['CheckoutLink']
  style?: StyleProp<TextStyle>
}

export const CheckoutLinkRow = ({
  checkoutLink,
  style,
}: CheckoutLinkRowProps) => {
  const theme = useTheme()

  const productLabel =
    checkoutLink.products.length === 1
      ? checkoutLink.products[0].name
      : `${checkoutLink.products.length} Products`

  return (
    <Link
      href={`/catalogue/checkout-links/${checkoutLink.id}`}
      style={[
        {
          padding: theme.spacing['spacing-16'],
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.borderRadii['border-radius-12'],
          gap: theme.spacing['spacing-12'],
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
      asChild
    >
      <Touchable>
        <Box
          width={48}
          height={48}
          borderRadius="border-radius-full"
          justifyContent="center"
          alignItems="center"
          backgroundColor="background"
        >
          <MaterialIcons name="link" size={24} color={theme.colors.text} />
        </Box>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Text
            variant="bodyMedium"
            style={{ flexShrink: 1 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {checkoutLink.label ?? 'Untitled'}
          </Text>
          <Text variant="bodySmall" color="subtext" numberOfLines={1}>
            {productLabel}
          </Text>
        </Box>
      </Touchable>
    </Link>
  )
}
