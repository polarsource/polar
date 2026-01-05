import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import {
  MaintainerAccountReviewedNotificationPayload,
  MaintainerAccountUnderReviewNotificationPayload,
  MaintainerCreateAccountNotificationPayload,
  MaintainerNewPaidSubscriptionNotificationPayload,
  MaintainerNewProductSaleNotificationPayload,
} from '@/hooks/polar/notifications'
import { formatCurrencyAndAmount } from '@/utils/money'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMemo } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { Text } from '../Shared/Text'

export interface NotificationProps {
  style?: StyleProp<ViewStyle>
  type: string
  createdAt: string
  payload:
    | MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerCreateAccountNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload
}

export const Notification = ({
  type,
  payload,
  style,
  createdAt,
}: NotificationProps) => {
  const theme = useTheme()

  const icon = useMemo(() => {
    switch (type) {
      case 'MaintainerNewPaidSubscriptionNotification':
        return (
          <MaterialIcons
            name="all-inclusive"
            size={20}
            color={theme.colors.text}
          />
        )
      case 'MaintainerNewProductSaleNotification':
        return (
          <MaterialIcons
            name="lightbulb-outline"
            size={20}
            color={theme.colors.text}
          />
        )
      case 'MaintainerAccountUnderReviewNotification':
        return (
          <MaterialIcons
            name="person-outline"
            size={20}
            color={theme.colors.text}
          />
        )
      case 'MaintainerAccountReviewedNotification':
        return (
          <MaterialIcons
            name="person-outline"
            size={20}
            color={theme.colors.text}
          />
        )
      case 'MaintainerCreateAccountNotification':
        return (
          <MaterialIcons
            name="person-outline"
            size={20}
            color={theme.colors.text}
          />
        )
      default:
        return (
          <MaterialIcons
            name="notifications"
            size={20}
            color={theme.colors.text}
          />
        )
    }
  }, [type, theme.colors.text])

  const title = useMemo(() => {
    switch (type) {
      case 'MaintainerNewPaidSubscriptionNotification':
        return 'New Subscription'
      case 'MaintainerNewProductSaleNotification':
        return 'New Product Sale'
      case 'MaintainerAccountUnderReviewNotification':
        return 'Account Under Review'
      case 'MaintainerAccountReviewedNotification':
        return 'Account Reviewed'
      case 'MaintainerCreateAccountNotification':
        return 'New Account Created'
      default:
        return 'New Notification'
    }
  }, [type])

  const description = useMemo(() => {
    switch (type) {
      case 'MaintainerNewPaidSubscriptionNotification':
        const { subscriber_name, tier_name } =
          payload as MaintainerNewPaidSubscriptionNotificationPayload
        return `${subscriber_name} subscribed to ${tier_name}`
      case 'MaintainerNewProductSaleNotification':
        const { customer_name, product_name, product_price_amount } =
          payload as MaintainerNewProductSaleNotificationPayload
        return `${customer_name} bought ${product_name} for ${formatCurrencyAndAmount(
          product_price_amount,
        )}`
      case 'MaintainerAccountUnderReviewNotification':
        return 'Your account is under review'
      case 'MaintainerAccountReviewedNotification':
        return 'Your account has been reviewed'
      case 'MaintainerCreateAccountNotification':
        return 'A new account has been created'
      default:
        return 'A new notification has been created'
    }
  }, [type])

  return (
    <Box flexDirection="row" gap="spacing-16" style={style}>
      <Box
        backgroundColor="card"
        width={40}
        height={40}
        borderRadius="border-radius-8"
        alignItems="center"
        justifyContent="center"
      >
        <Text>{icon}</Text>
      </Box>
      <Box flex={1} flexDirection="column" gap="spacing-4">
        <Box flexDirection="row" gap="spacing-12">
          <Text>{title}</Text>
          <Text color="subtext">
            {new Date(createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: 'numeric',
            })}
          </Text>
        </Box>
        <Text color="subtext">{description}</Text>
      </Box>
    </Box>
  )
}
