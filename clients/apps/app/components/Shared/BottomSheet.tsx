import { useTheme } from '@/design-system/useTheme'
import GorhomBottomSheet, {
  BottomSheetBackdrop as GorhomBottomSheetBackdrop,
  BottomSheetProps as GorhomBottomSheetProps,
  BottomSheetView as GorhomBottomSheetView,
} from '@gorhom/bottom-sheet'
import React, { useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface BottomSheetProps
  extends React.PropsWithChildren, Omit<GorhomBottomSheetProps, 'children'> {
  onDismiss?: () => void
}

export const BottomSheet = ({
  children,
  onDismiss,
  ...props
}: BottomSheetProps) => {
  const bottomSheetRef = useRef<GorhomBottomSheet>(null)
  const theme = useTheme()

  const safeViewInsets = useSafeAreaInsets()

  return (
    <GorhomBottomSheet
      ref={bottomSheetRef}
      onClose={onDismiss}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadii['border-radius-32'],
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.subtext,
      }}
      {...props}
      backdropComponent={(backdropProps) => (
        <GorhomBottomSheetBackdrop
          {...backdropProps}
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
      <GorhomBottomSheetView
        style={{
          flex: 1,
          padding: theme.spacing['spacing-24'],
          gap: theme.spacing['spacing-12'],
          paddingBottom: safeViewInsets.bottom + 12,
        }}
      >
        {children}
      </GorhomBottomSheetView>
    </GorhomBottomSheet>
  )
}
