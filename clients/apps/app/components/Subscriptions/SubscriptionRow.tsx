import { Box } from '@/components/Shared/Box'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'
import AmountLabel from '../Products/AmountLabel'
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
            <AmountLabel
              loading={loading}
              amount={subscription?.amount ?? 0}
              currency={subscription?.currency || 'usd'}
              interval={subscription?.recurring_interval}
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
                  {subscription?.customer.name || subscription?.customer.email}
                </Text>
              </>
            ) : null}
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
