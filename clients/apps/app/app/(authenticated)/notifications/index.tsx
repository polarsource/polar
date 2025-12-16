import { Notification } from '@/components/Notifications/Notification'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import {
  Notification as PolarNotification,
  useListNotifications,
  useNotificationsMarkRead,
} from '@/hooks/polar/notifications'
import { FlashList } from '@shopify/flash-list'
import { setBadgeCountAsync } from 'expo-notifications'
import { Stack } from 'expo-router'
import React, { useEffect } from 'react'
import { RefreshControl } from 'react-native'

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

  useEffect(() => {
    if (notifications?.notifications.length) {
      markNotificationAsRead.mutateAsync({
        notificationId: notifications.notifications[0].id,
      })

      setBadgeCountAsync(0)
    }
  }, [notifications])

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

          return (
            <Notification
              type={item.type}
              payload={item.payload}
              createdAt={item.created_at}
              style={{ marginBottom: theme.spacing['spacing-16'] }}
            />
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
