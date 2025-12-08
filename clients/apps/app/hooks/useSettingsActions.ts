import { useLogout } from '@/hooks/auth'
import { useDeleteOrganization } from '@/hooks/polar/organizations'
import { useDeleteUser } from '@/hooks/polar/users'
import { schemas } from '@polar-sh/client'
import { useCallback, useState } from 'react'
import { Alert, Linking } from 'react-native'

const SUPPORT_URL = 'https://polar.sh/docs/support'

interface UseSettingsActionsOptions {
  selectedOrganization: schemas['Organization'] | undefined
  organizations: schemas['Organization'][]
  setOrganization: (organization: schemas['Organization']) => void
  refetch: () => Promise<unknown>
  userEmail: string | undefined
}

export const useSettingsActions = ({
  selectedOrganization,
  organizations,
  setOrganization,
  refetch,
}: UseSettingsActionsOptions) => {
  const logout = useLogout()
  const deleteOrganization = useDeleteOrganization()
  const deleteUser = useDeleteUser()

  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const showSupportAlert = useCallback((title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Contact Support',
        onPress: () => Linking.openURL(SUPPORT_URL),
      },
    ])
  }, [])

  const performDeleteAccount = useCallback(async () => {
    setIsDeletingAccount(true)
    try {
      const nonDeletableOrgs: string[] = []
      const deletedOrgIds: string[] = []

      // Start with deleting all organizations tied to the account
      for (const org of organizations) {
        const { data, error } = await deleteOrganization.mutateAsync(org.id)

        if (error || data?.requires_support) {
          nonDeletableOrgs.push(org.name)
        } else if (data?.deleted) {
          deletedOrgIds.push(org.id)
        }
      }

      if (nonDeletableOrgs.length > 0) {
        if (
          selectedOrganization &&
          deletedOrgIds.includes(selectedOrganization.id)
        ) {
          const remainingOrg = organizations.find(
            (org) => !deletedOrgIds.includes(org.id),
          )
          if (remainingOrg) {
            setOrganization(remainingOrg)
          }
        }

        await refetch()

        setIsDeletingAccount(false)
        const orgNames = nonDeletableOrgs.join(', ')
        showSupportAlert(
          'Unable to delete account',
          `The following organization${nonDeletableOrgs.length > 1 ? 's have' : ' has'} active orders and cannot be deleted: ${orgNames}. Please contact support for assistance.`,
        )
        return
      }

      // Lastly we delete the actual user account
      const { data, error } = await deleteUser.mutateAsync()

      if (error) {
        setIsDeletingAccount(false)
        showSupportAlert(
          'Unable to delete account',
          'An unexpected error occurred. Please contact support for assistance.',
        )
        return
      }

      if (data?.deleted) {
        logout()
      } else {
        setIsDeletingAccount(false)
        showSupportAlert(
          'Unable to delete account',
          'An unexpected error occurred. Please contact support for assistance.',
        )
      }
    } catch (err) {
      console.error('[Delete Account] Unexpected error:', err)
      setIsDeletingAccount(false)
      showSupportAlert(
        'Unable to delete account',
        'An unexpected error occurred. Please contact support for assistance.',
      )
    }
  }, [
    organizations,
    selectedOrganization,
    setOrganization,
    deleteOrganization,
    deleteUser,
    showSupportAlert,
    logout,
    refetch,
  ])

  return {
    performDeleteAccount,
    isDeletingAccount,
    logout,
  }
}
