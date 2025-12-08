import { Button } from '@/components/Shared/Button'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useSettingsActions } from '@/hooks/useSettingsActions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useUser } from '@/providers/UserProvider'
import { themes } from '@/utils/theme'
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
      backgroundStyle={styles.background}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          enableTouchThrough={false}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          style={[styles.dimmer, StyleSheet.absoluteFillObject]}
        />
      )}
    >
      <BottomSheetView
        style={[
          styles.contentContainer,
          { paddingBottom: safeViewInsets.bottom + 12 },
        ]}
      >
        <ThemedText style={styles.title}>Delete Account</ThemedText>
        <ThemedText style={styles.description} secondary>
          Deleting your organizations & account is an irreversible action.
        </ThemedText>
        <BottomSheetTextInput
          style={styles.input}
          placeholderTextColor={'rgba(255, 255, 255, .5)'}
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

const styles = StyleSheet.create({
  dimmer: {
    flex: 1,
    backgroundColor: '#000000aa',
  },
  background: {
    backgroundColor: themes.dark.card,
    borderRadius: 32,
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
  },
  description: {
    fontSize: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, .05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 12,
    fontSize: 16,
    color: themes.dark.monochromeInverted,
  },
})
