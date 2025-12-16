import { Box } from '@/components/Shared/Box'
import { Image } from '@/components/Shared/Image/Image'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'
import { ProductPriceLabel } from '../Products/ProductPriceLabel'
import { Pill } from '../Shared/Pill'
import { Text } from '../Shared/Text'

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
  subscription?: schemas['Subscription']
  showCustomer?: boolean
  style?: StyleProp<TextStyle>
  loading?: boolean
}

export const SubscriptionRow = ({
  subscription,
  style,
  showCustomer,
  loading,
}: SubscriptionRowProps) => {
  const theme = useTheme()
  const product = subscription?.product

  return (
    <Link
      href={`/subscriptions/${subscription?.id}`}
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
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-8"
          >
            <Text
              loading={loading}
              variant="bodyMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subscription?.product?.name}
            </Text>
            <Pill
              loading={loading}
              color={subscriptionStatusColors[subscription?.status || 'active']}
            >
              {subscription?.status.split('_').join(' ')}
            </Pill>
          </Box>
          <Box flex={1} flexDirection="row" alignItems="center" gap="spacing-8">
            <ProductPriceLabel
              loading={loading}
              product={subscription?.product}
            />
            {showCustomer ? (
              <>
                <Text
                  style={{ flexShrink: 1, display: loading ? 'none' : 'flex' }}
                  color="subtext"
                >
                  •
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, flexWrap: 'wrap' }}
                  color="subtext"
                  loading={loading}
                  placeholderText="johndoe@example.com"
                >
                  {subscription?.customer.email}
                </Text>
              </>
            ) : null}
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
