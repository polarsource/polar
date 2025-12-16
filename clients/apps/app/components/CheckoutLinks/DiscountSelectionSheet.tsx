import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useInfiniteDiscounts } from '@/hooks/polar/discounts'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { schemas } from '@polar-sh/client'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface DiscountSelectionSheetProps {
  onDismiss: () => void
  onSelect: (discount: schemas['Discount'] | null) => void
  selectedDiscountId: string | null
}

function getDiscountDisplay(discount: schemas['Discount']): string {
  if (discount.type === 'percentage') {
    if ('basis_points' in discount) {
      return `${discount.basis_points / 100}% off`
    }
  }
  if ('amount' in discount && discount.amount) {
    return `$${(discount.amount / 100).toFixed(2)} off`
  }
  return 'Discount'
}

export const DiscountSelectionSheet = ({
  onDismiss,
  onSelect,
  selectedDiscountId,
}: DiscountSelectionSheetProps) => {
  const theme = useTheme()
  const bottomSheetRef = useRef<BottomSheet>(null)
  const insets = useSafeAreaInsets()
  const { organization } = useContext(OrganizationContext)

  const { data, isLoading } = useInfiniteDiscounts(organization?.id, {
    sorting: ['name'],
  })

  const discounts = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const listData = useMemo(
    () => [null, ...discounts] as (schemas['Discount'] | null)[],
    [discounts],
  )

  const handleSelect = useCallback(
    (discount: schemas['Discount'] | null) => {
      onSelect(discount)
      onDismiss()
    },
    [onSelect, onDismiss],
  )

  const renderDiscountItem = useCallback(
    (item: schemas['Discount'] | null) => {
      if (item === null) {
        const isSelected = selectedDiscountId === null
        return (
          <Touchable
            key="no-discount"
            onPress={() => handleSelect(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing['spacing-16'],
              borderRadius: theme.borderRadii['border-radius-12'],
              backgroundColor: isSelected ? theme.colors.card : 'transparent',
              gap: theme.spacing['spacing-12'],
            }}
          >
            <Box flex={1}>
              <Text variant="body" color={isSelected ? 'text' : 'subtext'}>
                No discount
              </Text>
            </Box>
            {isSelected ? (
              <MaterialIcons
                name="check"
                size={20}
                color={theme.colors.primary}
              />
            ) : null}
          </Touchable>
        )
      }

      const isSelected = selectedDiscountId === item.id
      return (
        <Touchable
          key={item.id}
          onPress={() => handleSelect(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: theme.spacing['spacing-16'],
            borderRadius: theme.borderRadii['border-radius-12'],
            backgroundColor: isSelected ? theme.colors.card : 'transparent',
            gap: theme.spacing['spacing-12'],
          }}
        >
          <Box flex={1} flexDirection="column" gap="spacing-4">
            <Text variant="body">{item.name}</Text>
            <Text variant="bodySmall" color="subtext">
              {getDiscountDisplay(item)}
            </Text>
          </Box>
          {isSelected ? (
            <MaterialIcons
              name="check"
              size={20}
              color={theme.colors.primary}
            />
          ) : null}
        </Touchable>
      )
    },
    [selectedDiscountId, handleSelect, theme],
  )

  return (
    <BottomSheet
      ref={bottomSheetRef}
      enableDynamicSizing
      maxDynamicContentSize={600}
      onClose={onDismiss}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadii['border-radius-32'],
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.subtext,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          enableTouchThrough={false}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          style={[
            { backgroundColor: theme.colors.overlay },
            StyleSheet.absoluteFillObject,
          ]}
        />
      )}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing['spacing-24'],
          paddingBottom: insets.bottom + theme.spacing['spacing-24'],
        }}
      >
        <Box paddingTop="spacing-8" paddingBottom="spacing-16" gap="spacing-8">
          <Text variant="title">Select Discount</Text>
          <Text variant="bodySmall" color="subtext">
            Choose a preset discount for this checkout link.
          </Text>
        </Box>

        {isLoading ? (
          <Box padding="spacing-24" justifyContent="center" alignItems="center">
            <ActivityIndicator />
          </Box>
        ) : (
          <Box gap="spacing-8">{listData.map(renderDiscountItem)}</Box>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}
