import { Box } from '@/components/Shared/Box'
import { Image } from '@/components/Shared/Image/Image'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useProduct } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React, { useContext } from 'react'
import { StyleProp, TextStyle } from 'react-native'
import { Touchable } from '../Shared/Touchable'

export interface OrderRowProps {
  order?: schemas['Order']
  showTimestamp?: boolean
  style?: StyleProp<TextStyle>
  loading?: boolean
}

export const OrderRow = ({
  order,
  style,
  showTimestamp,
  loading,
}: OrderRowProps) => {
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const { data: product } = useProduct(organization?.id, order?.product?.id)

  return (
    <Link
      href={`/orders/${order?.id}`}
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
          borderRadius="border-radius-8"
          overflow="hidden"
        >
          {product?.medias?.[0]?.public_url ? (
            <Image
              source={{ uri: product?.medias?.[0]?.public_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
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
          <Text variant="bodyMedium" loading={loading}>
            {order?.product?.name}
          </Text>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            {showTimestamp ? (
              <>
                <Text
                  color="subtext"
                  loading={loading}
                  placeholderText="12/12/2025"
                >
                  {new Date(order?.created_at || new Date()).toLocaleDateString(
                    'en-US',
                    {
                      dateStyle: 'medium',
                    },
                  )}
                </Text>
                {loading ? null : <Text color="subtext">•</Text>}
              </>
            ) : null}
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, flexWrap: 'wrap' }}
              color="subtext"
            >
              {order?.customer.email}
            </Text>
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
