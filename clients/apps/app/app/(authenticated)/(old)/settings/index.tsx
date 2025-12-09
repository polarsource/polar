import { DeleteAccountSheet } from '@/components/Errors/Accouns/DeleteAccountSheet'
import { Avatar } from '@/components/Shared/Avatar'
import { Button } from '@/components/Shared/Button'
import { MiniButton } from '@/components/Shared/MiniButton'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useTheme } from '@/hooks/theme'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Stack, useRouter } from 'expo-router'
import React, { useContext, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Index() {
  const {
    setOrganization,
    organization: selectedOrganization,
    organizations,
  } = useContext(OrganizationContext)
  const router = useRouter()

  const { colors } = useTheme()
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
    <GestureHandlerRootView style={SettingsStyle.gestureRoot}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={[
          SettingsStyle.container,
          { paddingBottom: safeAreaInsets.bottom },
        ]}
      >
        <Stack.Screen options={{ title: 'Settings' }} />
        <View style={{ gap: 32 }}>
          <View style={{ gap: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <ThemedText style={[SettingsStyle.title]}>
                Organizations
              </ThemedText>
              <MiniButton
                onPress={() => router.push('/onboarding')}
                icon={
                  <MaterialIcons
                    name="add"
                    size={16}
                    color={colors.monochrome}
                  />
                }
              >
                New
              </MiniButton>
            </View>
            <View style={SettingsStyle.organizationsContainer}>
              {organizationData?.items.map((organization) => (
                <TouchableOpacity
                  key={organization?.id}
                  style={[
                    SettingsStyle.organization,
                    {
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={() => {
                    setOrganization(organization)
                    router.back()
                  }}
                  activeOpacity={0.6}
                >
                  <View style={SettingsStyle.organizationContent}>
                    <Avatar
                      size={32}
                      image={organization?.avatar_url}
                      name={organization?.name}
                    />
                    <ThemedText style={[SettingsStyle.organizationName]}>
                      {organization?.name}
                    </ThemedText>
                  </View>
                  {selectedOrganization?.id === organization?.id ? (
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={colors.monochromeInverted}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ gap: 16 }}>
            <View>
              <ThemedText style={[SettingsStyle.title]}>Danger zone</ThemedText>
              <ThemedText style={{ color: colors.subtext }}>
                Irreversible actions for this account
              </ThemedText>
            </View>
            <View
              style={{
                padding: 16,
                borderRadius: 24,
                borderWidth: 1,
                gap: 12,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ gap: 4 }}>
                <ThemedText style={[SettingsStyle.subTitle]}>
                  Account Deletion
                </ThemedText>
                <ThemedText secondary>
                  Permanently delete this account, all organizations, and all
                  associated data. This action cannot be undone.
                </ThemedText>
              </View>
              <MiniButton
                variant="destructive"
                onPress={() => setShowAccountDeletionSheet(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                Delete Account
              </MiniButton>
            </View>
          </View>
        </View>

        <View style={SettingsStyle.buttonsContainer}>
          <Button onPress={logout}>Logout</Button>
        </View>
      </ScrollView>

      {showAccountDeletionSheet ? (
        <DeleteAccountSheet
          onDismiss={() => setShowAccountDeletionSheet(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  )
}

const SettingsStyle = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    margin: 16,
    gap: 24,
    justifyContent: 'space-between',
  },
  organizationsContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  title: {
    fontSize: 20,
  },
  subTitle: {
    fontSize: 18,
  },
  organization: {
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  organizationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  organizationName: {
    fontSize: 16,
  },
  logoutButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonsContainer: {
    gap: 12,
  },
})
