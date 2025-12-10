import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { Image, StyleProp, TextStyle, TouchableOpacity } from 'react-native'
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
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-8"
          >
            <ThemedText
              style={{ fontSize: 16, fontWeight: '500' }}
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
                <ThemedText style={{ fontSize: 16, flexShrink: 1 }} secondary>
                  •
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={{ fontSize: 16, flexShrink: 1, flexWrap: 'wrap' }}
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
