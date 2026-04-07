import { DeleteAccountSheet } from '@/components/Accounts/DeleteAccountSheet'
import { OrganizationsSheet } from '@/components/Settings/OrganizationsSheet'
import { SettingsItem } from '@/components/Settings/SettingsList'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import Constants from 'expo-constants'
import { useUpdates } from 'expo-updates'
import { Stack, useRouter } from 'expo-router'
import React, { useContext, useState } from 'react'
import { Linking, RefreshControl, ScrollView } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const APP_VERSION = Constants.expoConfig?.version ?? 'Unknown'

function UpdateId() {
  const { currentlyRunning } = useUpdates()
  const updateId = currentlyRunning.updateId

  if (!updateId) return null

  return (
    <Text variant="caption" color="subtext" textAlign="center">
      {updateId.slice(0, 8)}
    </Text>
  )
}

export default function Index() {
  const {
    setOrganization,
    organization: selectedOrganization,
    organizations,
  } = useContext(OrganizationContext)

  const theme = useTheme()
  const { refetch, isRefetching } = useOrganizations()
  const { user } = useUser()

  const { logout } = useSettingsActions({
    selectedOrganization,
    organizations,
    setOrganization,
    refetch,
    userEmail: user?.email,
  })

  const safeAreaInsets = useSafeAreaInsets()

  const [showAccountDeletionSheet, setShowAccountDeletionSheet] =
    useState(false)
  const [showOrganizationsSheet, setShowOrganizationsSheet] = useState(false)
  const router = useRouter()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={{
          flex: 1,
          margin: theme.spacing['spacing-16'],
          gap: theme.spacing['spacing-24'],
          justifyContent: 'space-between',
          paddingBottom: safeAreaInsets.bottom,
        }}
      >
        <Stack.Screen options={{ title: 'Settings' }} />
        <Box>
          <SettingsItem
            title="Organization"
            variant="select"
            onPress={() => {
              setShowOrganizationsSheet(true)
            }}
          >
            <Text variant="body" numberOfLines={1}>
              {selectedOrganization?.name}
            </Text>
          </SettingsItem>
          <SettingsItem
            title="Notifications"
            variant="navigate"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsItem
            title="Subscriptions"
            variant="navigate"
            onPress={() => router.push('/settings/subscriptions')}
          />
          <Box height={1} backgroundColor="border" marginVertical="spacing-8" />
          <SettingsItem
            title="Support"
            variant="link"
            onPress={() => Linking.openURL('https://polar.sh/docs/support')}
          />
          <SettingsItem
            title="Privacy Policy"
            variant="link"
            onPress={() =>
              Linking.openURL('https://polar.sh/legal/privacy-policy')
            }
          />
          <SettingsItem
            title="Terms of Service"
            variant="link"
            onPress={() =>
              Linking.openURL('https://polar.sh/legal/master-services-terms')
            }
          />
          <Box height={1} backgroundColor="border" marginVertical="spacing-8" />
          <SettingsItem
            title="Delete Account"
            variant="navigate"
            onPress={() => setShowAccountDeletionSheet(true)}
          />
          <SettingsItem title="Logout" variant="navigate" onPress={logout} />
        </Box>
        <Box
          justifyContent="center"
          flexDirection="column"
          alignItems="center"
          gap="spacing-4"
        >
          <Text variant="body" color="subtext" textAlign="center">
            {`Polar (${APP_VERSION})`}
          </Text>
          <UpdateId />
        </Box>
      </ScrollView>

      {showAccountDeletionSheet ? (
        <DeleteAccountSheet
          onDismiss={() => setShowAccountDeletionSheet(false)}
        />
      ) : null}

      {showOrganizationsSheet ? (
        <OrganizationsSheet
          onDismiss={() => setShowOrganizationsSheet(false)}
          onSelect={() => router.back()}
        />
      ) : null}
    </GestureHandlerRootView>
  )
}
