import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import {
  Image,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
} from 'react-native'
import { ProductPriceLabel } from '../Products/ProductPriceLabel'
import { Pill } from '../Shared/Pill'
import { ThemedText } from '../Shared/ThemedText'

const subscriptionStatusColors: Record<
  schemas['SubscriptionStatus'],
  'green' | 'red' | 'blue' | 'yellow'
> = {
  active: 'green',
  canceled: 'red',
  trialing: 'blue',
  past_due: 'red',
  incomplete: 'yellow',
  incomplete_expired: 'red',
  unpaid: 'yellow',
}

export interface SubscriptionRowProps {
  subscription: schemas['Subscription']
  showCustomer?: boolean
  style?: StyleProp<TextStyle>
}

export const SubscriptionRow = ({
  subscription,
  style,
  showCustomer,
}: SubscriptionRowProps) => {
  const theme = useTheme()
  const product = subscription.product

  return (
    <Link
      href={`/subscriptions/${subscription.id}`}
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
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-8"
          >
            <ThemedText
              style={styles.productName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subscription.product.name}
            </ThemedText>
            <Pill color={subscriptionStatusColors[subscription.status]}>
              {subscription.status.split('_').join(' ')}
            </Pill>
          </Box>
          <Box flex={1} flexDirection="row" alignItems="center" gap="spacing-8">
            <ProductPriceLabel product={subscription.product} />
            {showCustomer && (
              <>
                <ThemedText style={styles.meta} secondary>
                  •
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={[styles.meta, { flexWrap: 'wrap' }]}
                  secondary
                >
                  {subscription.customer.email}
                </ThemedText>
              </>
            )}
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
  status: {
    fontSize: 16,
    textTransform: 'capitalize',
  },
  meta: {
    fontSize: 16,
    flexShrink: 1,
  },
})
