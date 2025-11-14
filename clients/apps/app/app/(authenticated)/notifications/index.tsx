import { Notification } from '@/components/Notifications/Notification'
import { ThemedText } from '@/components/Shared/ThemedText'
import {
  Notification as PolarNotification,
  useListNotifications,
  useNotificationsMarkRead,
} from '@/hooks/polar/notifications'
import { useTheme } from '@/hooks/theme'
import { setBadgeCountAsync } from 'expo-notifications'
import { Stack } from 'expo-router'
import React, { useEffect } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

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
  const { colors } = useTheme()
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
      <FlatList
        data={groupNotificationsByDate(notifications?.notifications ?? [])}
        ListEmptyComponent={
          isLoading ? null : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ThemedText style={{ fontSize: 16 }} secondary>
                No Notifications
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }: { item: PolarNotification | string }) => {
          if (typeof item === 'string') {
            return (
              <ThemedText
                style={{
                  paddingTop: 12,
                  paddingBottom: 24,
                  fontSize: 16,
                }}
              >
                {item}
              </ThemedText>
            )
          }

          return (
            <Notification
              key={item.id}
              type={item.type}
              payload={item.payload}
              createdAt={item.created_at}
              style={{ marginBottom: 16 }}
            />
          )
        }}
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
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
