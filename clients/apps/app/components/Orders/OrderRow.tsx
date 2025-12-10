import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useProduct } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React, { useContext } from 'react'
import { Image, StyleProp, TextStyle, TouchableOpacity } from 'react-native'
import { Text } from '../Shared/Text'

export interface OrderRowProps {
  order: schemas['Order']
  showTimestamp?: boolean
  style?: StyleProp<TextStyle>
}

export const OrderRow = ({ order, style, showTimestamp }: OrderRowProps) => {
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const { data: product } = useProduct(organization?.id, order.product?.id)

  return (
    <Link
      href={`/orders/${order.id}`}
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
      <TouchableOpacity activeOpacity={0.6}>
        <Box
          width={48}
          height={48}
          borderRadius="border-radius-8"
          overflow="hidden"
        >
          {product?.medias?.[0]?.public_url ? (
            <Image
              source={{ uri: product?.medias?.[0]?.public_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Box
              width="100%"
              height="100%"
              justifyContent="center"
              alignItems="center"
              borderColor="border"
              borderWidth={1}
              borderRadius="border-radius-8"
            >
              <MaterialIcons
                name="texture"
                size={24}
                color={theme.colors.subtext}
              />
            </Box>
          )}
        </Box>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Text variant="bodyMedium">{order.product?.name}</Text>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            {showTimestamp && (
              <>
                <Text color="subtext">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    dateStyle: 'medium',
                  })}
                </Text>
                <Text color="subtext">•</Text>
              </>
            )}
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, flexWrap: 'wrap' }}
              color="subtext"
            >
              {order.customer.email}
            </Text>
          </Box>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}
