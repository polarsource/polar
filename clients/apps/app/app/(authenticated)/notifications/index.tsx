import { Notification } from '@/components/Notifications/Notification'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import {
  Notification as PolarNotification,
  useListNotifications,
  useNotificationsMarkRead,
} from '@/hooks/polar/notifications'
import { FlashList } from '@shopify/flash-list'
import { setBadgeCountAsync } from 'expo-notifications'
import { Href, Link, Stack } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import { RefreshControl } from 'react-native'

const getNotificationHref = (notification: PolarNotification): Href | null => {
  switch (notification.type) {
    case 'MaintainerNewProductSaleNotification':
      return notification.payload.order_id
        ? `/orders/${notification.payload.order_id}`
        : null
    case 'MaintainerNewPaidSubscriptionNotification':
      return notification.payload.subscription_id
        ? `/subscriptions/${notification.payload.subscription_id}`
        : null
    default:
      return null
  }
}

const groupNotificationsByDate = (notifications: PolarNotification[]) => {
  if (!notifications?.length) return []

  const result: (PolarNotification | string)[] = []
  let currentDate: string | null = null

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.created_at)
    const wasLastYear =
      notificationDate.getFullYear() < new Date().getFullYear()
    const dateString = notificationDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: wasLastYear ? 'numeric' : undefined,
    })

    if (dateString !== currentDate) {
      currentDate = dateString
      result.push(dateString)
    }

    result.push(notification)
  })

  return result
}

export default function Notifications() {
  const theme = useTheme()
  const {
    data: notifications,
    refetch: refetchNotifications,
    isRefetching,
    isLoading,
  } = useListNotifications()
  const markNotificationAsRead = useNotificationsMarkRead()
  const markedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!notifications?.notifications.length) return

    const latestId = notifications.notifications[0].id
    const isUnread = latestId !== notifications.last_read_notification_id

    if (isUnread && markedIdRef.current !== latestId) {
      markedIdRef.current = latestId
      markNotificationAsRead.mutate({ notificationId: latestId })
    }

    setBadgeCountAsync(0)
  }, [notifications, markNotificationAsRead])

  return (
    <React.Fragment>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <FlashList
        data={groupNotificationsByDate(notifications?.notifications ?? [])}
        ListEmptyComponent={
          isLoading ? null : (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Text color="subtext">No Notifications</Text>
            </Box>
          )
        }
        renderItem={({ item }: { item: PolarNotification | string }) => {
          if (typeof item === 'string') {
            return (
              <Text paddingBottom="spacing-24" paddingTop="spacing-12">
                {item}
              </Text>
            )
          }

          const href = getNotificationHref(item)
          const notification = (
            <Notification
              type={item.type}
              payload={item.payload}
              createdAt={item.created_at}
              style={{ marginBottom: theme.spacing['spacing-16'] }}
            />
          )

          if (!href) {
            return notification
          }

          return (
            <Link href={href} asChild>
              <Touchable>{notification}</Touchable>
            </Link>
          )
        }}
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
          backgroundColor: theme.colors.background,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => (
          <Box style={{ height: theme.dimension['dimension-1'] }} />
        )}
        keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
        refreshControl={
          <RefreshControl
            onRefresh={refetchNotifications}
            refreshing={isRefetching}
          />
        }
      />
    </React.Fragment>
  )
}
