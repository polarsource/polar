import { Button } from '@/components/Shared/Button'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useTheme } from '@/design-system/useTheme'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import React, { useContext, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface DeleteAccountSheetProps {
  onDismiss: () => void
}

export const DeleteAccountSheet = ({ onDismiss }: DeleteAccountSheetProps) => {
  const bottomSheetRef = useRef<BottomSheet>(null)
  const theme = useTheme()

  const safeViewInsets = useSafeAreaInsets()

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
    <BottomSheet
      ref={bottomSheetRef}
      onClose={onDismiss}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadii['border-radius-32'],
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          enableTouchThrough={false}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          style={[
            { flex: 1, backgroundColor: theme.colors.overlay },
            StyleSheet.absoluteFillObject,
          ]}
        />
      )}
    >
      <BottomSheetView
        style={{
          flex: 1,
          padding: theme.spacing['spacing-24'],
          gap: theme.spacing['spacing-12'],
          paddingBottom: safeViewInsets.bottom + 12,
        }}
      >
        <ThemedText style={{ fontSize: 20 }}>Delete Account</ThemedText>
        <ThemedText style={{ fontSize: 16 }} secondary>
          Deleting your organizations & account is an irreversible action.
        </ThemedText>
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
      </BottomSheetView>
    </BottomSheet>
  )
}
