import { SettingsItem } from '@/components/Settings/SettingsList'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import {
  useCreateNotificationRecipient,
  useDeleteNotificationRecipient,
  useGetNotificationRecipient,
} from '@/hooks/polar/notifications'
import {
  useOrganization,
  useUpdateOrganization,
} from '@/hooks/polar/organizations'
import { useNotifications } from '@/providers/NotificationsProvider'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import * as Notifications from 'expo-notifications'
import { getPermissionsAsync } from 'expo-notifications'
import { Stack } from 'expo-router'
import { useCallback, useContext, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Switch } from 'react-native'

export default function NotificationsPage() {
  const theme = useTheme()

  const { organization } = useContext(OrganizationContext)
  const {
    refetch: refetchOrganization,
    isRefetching: isRefetchingOrganization,
  } = useOrganization()

  const {
    enablePushNotifications,
    disablePushNotifications,
    pushNotificationsEnabled,
  } = usePushNotifications()

  const { mutateAsync: updateOrganization } = useUpdateOrganization()

  const createNotificationSettingHandler = useCallback(
    (key: keyof schemas['OrganizationNotificationSettings']) =>
      async (value: boolean) => {
        if (!organization?.id) {
          return
        }

        await updateOrganization({
          organizationId: organization?.id,
          update: {
            notification_settings: {
              ...organization?.notification_settings,
              [key]: value,
            },
          },
        })
      },
    [organization, updateOrganization],
  )

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingOrganization}
            onRefresh={refetchOrganization}
          />
        }
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
          title="New Orders"
          description="Send a notification when new orders are created"
          variant="static"
        >
          <Switch
            value={organization?.notification_settings.new_order}
            onValueChange={createNotificationSettingHandler('new_order')}
          />
        </SettingsItem>
        <SettingsItem
          title="New Subscriptions"
          description="Send a notification when new subscriptions are created"
          variant="static"
        >
          <Switch
            value={organization?.notification_settings.new_subscription}
            onValueChange={createNotificationSettingHandler('new_subscription')}
          />
        </SettingsItem>
        <Box
          flexDirection="column"
          gap="spacing-4"
          marginVertical="spacing-12"
          padding="spacing-16"
          backgroundColor="card"
          borderRadius="border-radius-12"
        >
          <Text variant="bodySmall" color="subtext">
            These settings will affect both email & push notifications on all
            your devices.
          </Text>
        </Box>
      </ScrollView>
    </>
  )
}

const usePushNotifications = () => {
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(false)

  const { expoPushToken } = useNotifications()
  const { data: notificationRecipient } = useGetNotificationRecipient(
    expoPushToken ?? undefined,
  )
  const { mutateAsync: deleteNotificationRecipient } =
    useDeleteNotificationRecipient()

  const { mutateAsync: createNotificationRecipient } =
    useCreateNotificationRecipient()

  useEffect(() => {
    getPermissionsAsync().then((status) => {
      setPushNotificationsEnabled(status.granted && !!notificationRecipient?.id)
    })
  }, [notificationRecipient])

  const enablePushNotifications = useCallback(async () => {
    const status = await Notifications.requestPermissionsAsync()

    if (status.granted) {
      const token = await Notifications.getExpoPushTokenAsync()
      if (token.data) {
        await createNotificationRecipient(token.data)
      }
    }

    setPushNotificationsEnabled(status.granted)
  }, [createNotificationRecipient])

  const disablePushNotifications = useCallback(async () => {
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
