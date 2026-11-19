import { SettingsItem } from '@/components/Settings/SettingsList'
import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import {
  useCreateNotificationRecipient,
  useDeleteNotificationRecipient,
  useGetNotificationRecipient,
} from '@/hooks/polar/notifications'
import { setPushNotificationsOptedOut } from '@/hooks/pushNotificationOptOut'
import { useNotifications } from '@/providers/NotificationsProvider'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useToast } from '@/providers/ToastProvider'
import * as Notifications from 'expo-notifications'
import { Stack } from 'expo-router'
import { useCallback, useContext, useEffect, useState } from 'react'
import { Linking, ScrollView, Switch } from 'react-native'

export default function NotificationsPage() {
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)

  const {
    enablePushNotifications,
    disablePushNotifications,
    pushNotificationsEnabled,
  } = usePushNotifications()

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
        }}
      >
        <SettingsItem title="Push Notifications" variant="static">
          <Switch
            value={pushNotificationsEnabled}
            onValueChange={(value) => {
              if (value) {
                enablePushNotifications()
              } else {
                disablePushNotifications()
              }
            }}
          />
        </SettingsItem>
        <Box height={1} backgroundColor="border" marginVertical="spacing-8" />
        <SettingsItem
          title="Choose notifications on polar.sh"
          description="Pick which sales send email and push notifications"
          variant="link"
          onPress={() =>
            Linking.openURL(
              `https://polar.sh/dashboard/${organization?.slug}/settings/notifications`,
            )
          }
        />
      </ScrollView>
    </>
  )
}

const usePushNotifications = () => {
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(false)

  const toast = useToast()
  const { expoPushToken } = useNotifications()
  const { data: notificationRecipient } = useGetNotificationRecipient(
    expoPushToken ?? undefined,
  )
  const { mutateAsync: deleteNotificationRecipient } =
    useDeleteNotificationRecipient()

  const { mutateAsync: createNotificationRecipient } =
    useCreateNotificationRecipient()

  useEffect(() => {
    Notifications.getPermissionsAsync().then((status) => {
      setPushNotificationsEnabled(status.granted && !!notificationRecipient?.id)
    })
  }, [notificationRecipient])

  const enablePushNotifications = useCallback(async () => {
    await setPushNotificationsOptedOut(false)
    const status = await Notifications.requestPermissionsAsync()

    if (status.granted) {
      try {
        const token = await Notifications.getExpoPushTokenAsync()
        if (token.data) {
          await createNotificationRecipient(token.data)
          setPushNotificationsEnabled(true)
          return
        }
      } catch (error: any) {
        if (error?.response?.status === 422) {
          setPushNotificationsEnabled(true)
          return
        }
        const status = error?.response?.status
        const message = error?.error?.detail?.[0]?.msg || error?.message
        toast.showError(
          `Failed to enable push notifications${status ? ` (${status})` : ''}${message ? `: ${message}` : ''}`,
        )
      }
    }

    setPushNotificationsEnabled(status.granted)
  }, [createNotificationRecipient, toast])

  const disablePushNotifications = useCallback(async () => {
    await setPushNotificationsOptedOut(true)
    if (notificationRecipient?.id) {
      await deleteNotificationRecipient(notificationRecipient.id)
    }

    setPushNotificationsEnabled(false)
  }, [deleteNotificationRecipient, notificationRecipient])

  return {
    enablePushNotifications,
    disablePushNotifications,
    pushNotificationsEnabled,
  }
}
