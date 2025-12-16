import { CheckoutLinkRow } from '@/components/CheckoutLinks/CheckoutLinkRow'
import { ProductRow } from '@/components/Products/ProductRow'
import { Box } from '@/components/Shared/Box'
import { Tabs, TabsList, TabsTrigger } from '@/components/Shared/Tabs'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useInfiniteCheckoutLinks } from '@/hooks/polar/checkout_links'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import React, { useContext, useMemo, useState } from 'react'
import { RefreshControl, SafeAreaView } from 'react-native'

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

function CheckoutLinksList() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useInfiniteCheckoutLinks(organization?.id)

  const flatData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  return (
    <FlashList
      data={flatData}
      renderItem={({ item }: { item: schemas['CheckoutLink'] }) => (
        <CheckoutLinkRow checkoutLink={item} />
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
            <Text color="subtext">No Checkout Links</Text>
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
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState('products')

  return (
    <>
      <Stack.Screen options={{ title: 'Catalogue' }} />
      <SafeAreaView style={{ margin: theme.spacing['spacing-16'] }}>
        <Tabs defaultValue="products" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="checkout-links">Checkout Links</TabsTrigger>
          </TabsList>
        </Tabs>
      </SafeAreaView>
      <Box style={{ flex: 1 }}>
        {activeTab === 'products' ? <ProductsList /> : <CheckoutLinksList />}
      </Box>
    </>
  )
}
