import { Button } from '@/components/Shared/Button'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import React, { useContext, useState } from 'react'
import { BottomSheet } from '../Shared/BottomSheet'

export interface DeleteAccountSheetProps {
  onDismiss: () => void
}

export const DeleteAccountSheet = ({ onDismiss }: DeleteAccountSheetProps) => {
  const theme = useTheme()

  const [email, setEmail] = useState('')

  const {
    setOrganization,
    organization: selectedOrganization,
    organizations,
  } = useContext(OrganizationContext)
  const { refetch } = useOrganizations()
  const { user } = useUser()

  const { performDeleteAccount, isDeletingAccount } = useSettingsActions({
    selectedOrganization,
    organizations,
    setOrganization,
    refetch,
    userEmail: user?.email,
  })

  return (
    <BottomSheet onDismiss={onDismiss}>
      <Text variant="title">Delete Account</Text>
      <Text color="subtext">
        Deleting your organizations & account is an irreversible action.
      </Text>
      <Text color="subtext">Enter your email below to confirm.</Text>
      <BottomSheetTextInput
        style={{
          backgroundColor: theme.colors.inputBackground,
          borderRadius: theme.borderRadii['border-radius-12'],
          paddingHorizontal: theme.spacing['spacing-12'],
          paddingVertical: theme.spacing['spacing-10'],
          marginVertical: theme.spacing['spacing-12'],
          fontSize: 16,
          color: theme.colors.monochromeInverted,
        }}
        placeholderTextColor={theme.colors.inputPlaceholder}
        placeholder={user?.email}
        onChangeText={setEmail}
        value={email}
      />
      <Button
        disabled={email !== user?.email || isDeletingAccount}
        loading={isDeletingAccount}
        variant="destructive"
        onPress={performDeleteAccount}
      >
        Delete Account
      </Button>
    </BottomSheet>
  )
}
