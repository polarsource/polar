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
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { ThemedText } from '../Shared/ThemedText'

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
    <View style={[styles.container, style]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.card }]}>
        <ThemedText>{icon}</ThemedText>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText>{title}</ThemedText>
          <ThemedText secondary>
            {new Date(createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: 'numeric',
            })}
          </ThemedText>
        </View>
        <ThemedText secondary>{description}</ThemedText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
  },
})
