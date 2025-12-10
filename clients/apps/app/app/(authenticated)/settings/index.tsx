import { DeleteAccountSheet } from '@/components/Errors/Accouns/DeleteAccountSheet'
import { Avatar } from '@/components/Shared/Avatar'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { MiniButton } from '@/components/Shared/MiniButton'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useTheme } from '@/design-system/useTheme'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Stack, useRouter } from 'expo-router'
import React, { useContext, useState } from 'react'
import { RefreshControl, ScrollView, TouchableOpacity } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Index() {
  const {
    setOrganization,
    organization: selectedOrganization,
    organizations,
  } = useContext(OrganizationContext)
  const router = useRouter()

  const theme = useTheme()
  const { data: organizationData, refetch, isRefetching } = useOrganizations()
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
        <Box gap="spacing-32">
          <Box gap="spacing-16">
            <Box flexDirection="row" justifyContent="space-between">
              <ThemedText style={{ fontSize: 20 }}>Organizations</ThemedText>
              <MiniButton
                onPress={() => router.push('/onboarding')}
                icon={
                  <MaterialIcons
                    name="add"
                    size={16}
                    color={theme.colors.monochrome}
                  />
                }
              >
                New
              </MiniButton>
            </Box>
            <Box flexDirection="column" gap="spacing-4">
              {organizationData?.items.map((organization) => (
                <TouchableOpacity
                  key={organization?.id}
                  style={{
                    paddingVertical: theme.spacing['spacing-16'],
                    paddingLeft: theme.spacing['spacing-16'],
                    paddingRight: theme.spacing['spacing-24'],
                    borderRadius: theme.borderRadii['border-radius-12'],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing['spacing-12'],
                    justifyContent: 'space-between',
                    backgroundColor: theme.colors.card,
                  }}
                  onPress={() => {
                    setOrganization(organization)
                    router.back()
                  }}
                  activeOpacity={0.6}
                >
                  <Box flexDirection="row" alignItems="center" gap="spacing-12">
                    <Avatar
                      size={32}
                      image={organization?.avatar_url}
                      name={organization?.name}
                    />
                    <ThemedText style={{ fontSize: 16 }}>
                      {organization?.name}
                    </ThemedText>
                  </Box>
                  {selectedOrganization?.id === organization?.id ? (
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={theme.colors.monochromeInverted}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}
            </Box>
          </Box>
          <Box gap="spacing-16">
            <Box>
              <ThemedText style={{ fontSize: 20 }}>Danger zone</ThemedText>
              <ThemedText style={{ color: theme.colors.subtext }}>
                Irreversible actions for this account
              </ThemedText>
            </Box>
            <Box
              padding="spacing-16"
              borderRadius="border-radius-24"
              borderWidth={1}
              gap="spacing-12"
              backgroundColor="card"
            >
              <Box gap="spacing-4">
                <ThemedText style={{ fontSize: 18 }}>
                  Account Deletion
                </ThemedText>
                <ThemedText secondary>
                  Permanently delete this account, all organizations, and all
                  associated data. This action cannot be undone.
                </ThemedText>
              </Box>
              <MiniButton
                variant="destructive"
                onPress={() => setShowAccountDeletionSheet(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                Delete Account
              </MiniButton>
            </Box>
          </Box>
        </Box>

        <Box gap="spacing-12">
          <Button onPress={logout}>Logout</Button>
        </Box>
      </ScrollView>

      {showAccountDeletionSheet ? (
        <DeleteAccountSheet
          onDismiss={() => setShowAccountDeletionSheet(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  )
}
