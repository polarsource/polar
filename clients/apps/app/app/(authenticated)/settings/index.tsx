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
import React, { useContext } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'

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

  const { handleDeleteAccount, logout, isDeletingAccount } = useSettingsActions(
    {
      selectedOrganization,
      organizations,
      setOrganization,
      refetch,
      userEmail: user?.email,
    },
  )

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      contentInset={{ bottom: 16 }}
      contentContainerStyle={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: 'Settings' }} />
      <SafeAreaView style={SettingsStyle.container}>
        <View style={{ gap: 24 }}>
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
                    color={colors.monochromeInverted}
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
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={
                      selectedOrganization?.id === organization?.id
                        ? colors.monochromeInverted
                        : 'transparent'
                    }
                  />
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
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
              }}
            >
              <View>
                <ThemedText style={[SettingsStyle.subTitle]}>
                  Delete account
                </ThemedText>
                <ThemedText style={{ color: colors.subtext }}>
                  Permanently delete this account, all organizations, and all
                  associated data. This action cannot be undone.
                </ThemedText>
              </View>
              <Button
                variant="secondary"
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <ThemedText
                    style={{
                      color: colors.error,
                      fontSize: 16,
                      fontWeight: '500',
                    }}
                  >
                    {isDeletingAccount ? 'Deleting account' : 'Delete Account'}
                  </ThemedText>
                  {isDeletingAccount && (
                    <ActivityIndicator size="small" color={colors.error} />
                  )}
                </View>
              </Button>
            </View>
          </View>
        </View>

        <View style={SettingsStyle.buttonsContainer}>
          <Button onPress={logout}>Logout</Button>
        </View>
      </SafeAreaView>
    </ScrollView>
  )
}

const SettingsStyle = StyleSheet.create({
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
