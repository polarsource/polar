import { ProductRow } from '@/components/Products/ProductRow'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { Stack } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useInfiniteProducts(organization?.id)

  const flatData = useMemo(() => {
    return (
      data?.pages
        .flatMap((page) => page.items)
        .sort((a, b) => (a.is_archived ? 1 : -1) - (b.is_archived ? 1 : -1)) ??
      []
    )
  }, [data])

  return (
    <>
      <Stack.Screen options={{ title: 'Products' }} />
      <FlatList
        data={flatData}
        renderItem={({ item }: { item: schemas['Product'] }) => (
          <ProductRow product={item} />
        )}
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
          gap: 4,
          flexGrow: 1,
          paddingBottom: 32,
        }}
        ListEmptyComponent={
          isLoading ? null : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ThemedText style={{ fontSize: 16 }} secondary>
                No Products
              </ThemedText>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
        }
        onEndReached={() => {
          if (hasNextPage) {
            fetchNextPage()
          }
        }}
        onEndReachedThreshold={0.8}
      />
    </>
  )
}
