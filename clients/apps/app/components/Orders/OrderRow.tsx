import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useProduct } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React, { useContext } from 'react'
import {
  Image,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
} from 'react-native'
import { ThemedText } from '../Shared/ThemedText'

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
      style={[styles.container, { backgroundColor: theme.colors.card }, style]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <Box style={styles.imageContainer}>
          {product?.medias?.[0]?.public_url ? (
            <Image
              source={{ uri: product?.medias?.[0]?.public_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <Box
              style={styles.imageFallback}
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
          <ThemedText style={styles.productName}>
            {order.product?.name}
          </ThemedText>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            {showTimestamp && (
              <>
                <ThemedText style={[styles.amount]} secondary>
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    dateStyle: 'medium',
                  })}
                </ThemedText>
                <ThemedText secondary>•</ThemedText>
              </>
            )}
            <ThemedText
              numberOfLines={1}
              style={[styles.email, { flexWrap: 'wrap' }]}
              secondary
            >
              {order.customer.email}
            </ThemedText>
          </Box>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 12,
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
  },
  amount: {
    fontSize: 16,
  },
  email: {
    fontSize: 16,
    flexShrink: 1,
  },
})
