import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet'
import { schemas } from '@polar-sh/client'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ListRenderItem, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export interface ProductSelectionSheetProps {
  onDismiss: () => void
  onSelect: (productIds: string[]) => void
  selectedProductIds: string[]
}

export const ProductSelectionSheet = ({
  onDismiss,
  onSelect,
  selectedProductIds,
}: ProductSelectionSheetProps) => {
  const theme = useTheme()
  const bottomSheetRef = useRef<BottomSheet>(null)
  const insets = useSafeAreaInsets()

  const { organization } = useContext(OrganizationContext)
  const [selected, setSelected] = useState<string[]>(selectedProductIds)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteProducts(organization?.id, {
      is_archived: false,
    })

  const products = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const toggleProduct = useCallback(
    (productId: string) => {
      const newSelected = selected.includes(productId)
        ? selected.filter((id) => id !== productId)
        : [...selected, productId]
      setSelected(newSelected)
      onSelect(newSelected)
    },
    [selected, onSelect],
  )

  const renderItem: ListRenderItem<schemas['Product']> = useCallback(
    ({ item: product }) => {
      const isSelected = selected.includes(product.id)
      return (
        <Touchable
          onPress={() => toggleProduct(product.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: theme.spacing['spacing-16'],
            borderRadius: theme.borderRadii['border-radius-12'],
            backgroundColor: isSelected ? theme.colors.card : 'transparent',
            gap: theme.spacing['spacing-12'],
          }}
        >
          <Box
            width={24}
            height={24}
            borderRadius="border-radius-full"
            borderWidth={2}
            borderColor={isSelected ? 'primary' : 'border'}
            justifyContent="center"
            alignItems="center"
            backgroundColor={isSelected ? 'primary' : undefined}
          >
            {isSelected ? (
              <MaterialIcons name="check" size={16} color={theme.colors.card} />
            ) : null}
          </Box>
          <Box flex={1}>
            <Text variant="body">{product.name}</Text>
          </Box>
        </Touchable>
      )
    },
    [selected, toggleProduct, theme],
  )

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={['80%']}
      onClose={onDismiss}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadii['border-radius-32'],
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.subtext,
      }}
      topInset={insets.top}
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
      <Box
        paddingHorizontal="spacing-24"
        paddingTop="spacing-8"
        paddingBottom="spacing-16"
        gap="spacing-8"
      >
        <Text variant="title">
          Select Products{selected.length > 0 ? ` (${selected.length})` : ''}
        </Text>
        <Text variant="bodySmall" color="subtext">
          Choose one or more products for this checkout link.
        </Text>
      </Box>

      {isLoading ? (
        <Box flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator />
        </Box>
      ) : (
        <BottomSheetFlatList
          data={products}
          renderItem={renderItem}
          keyExtractor={(item: schemas['Product']) => item.id}
          ItemSeparatorComponent={() => (
            <Box height={theme.spacing['spacing-8']} />
          )}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing['spacing-24'],
            paddingBottom: insets.bottom + theme.spacing['spacing-24'],
          }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage()
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Box padding="spacing-16" alignItems="center">
                <ActivityIndicator />
              </Box>
            ) : null
          }
          ListEmptyComponent={
            <Box padding="spacing-16" alignItems="center">
              <Text variant="body" color="subtext">
                No products available
              </Text>
            </Box>
          }
        />
      )}
    </BottomSheet>
  )
}
