import { ProductRow } from '@/components/Products/ProductRow'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { RefreshControl } from 'react-native'

function ProductsList() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()
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
    <FlashList
      data={flatData}
      renderItem={({ item }: { item: schemas['Product'] }) => (
        <ProductRow product={item} />
      )}
      contentContainerStyle={{
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
        flexGrow: 1,
        paddingBottom: theme.spacing['spacing-32'],
      }}
      ListEmptyComponent={
        isLoading ? null : (
          <Box flex={1} justifyContent="center" alignItems="center">
            <Text color="subtext">No Products</Text>
          </Box>
        )
      }
      ItemSeparatorComponent={() => <Box padding="spacing-4" />}
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
  )
}

export default function Index() {
  return (
    <>
      <Stack.Screen options={{ title: 'Products' }} />
      <ProductsList />
    </>
  )
}
