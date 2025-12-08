import { MiniButton } from '@/components/Shared/MiniButton'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useUser } from '@/providers/UserProvider'
import { themes } from '@/utils/theme'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import React, { useCallback, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface DeleteAccountSheetProps {
  onDelete: () => void
  onDismiss: () => void
}

export const DeleteAccountSheet = ({
  onDelete,
  onDismiss,
}: DeleteAccountSheetProps) => {
  const bottomSheetRef = useRef<BottomSheet>(null)

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index)
  }, [])

  const { user } = useUser()
  const safeViewInsets = useSafeAreaInsets()

  const [email, setEmail] = useState('')

  return (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={handleSheetChanges}
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
        <MiniButton
          style={{ alignSelf: 'flex-start' }}
          onPress={console.log}
          disabled={email !== user?.email}
        >
          Delete Account
        </MiniButton>
      </BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  dimmer: {
    flex: 1,
    backgroundColor: '#00000088',
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
