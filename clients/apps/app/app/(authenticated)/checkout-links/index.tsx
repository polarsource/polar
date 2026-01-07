import { CheckoutLinkRow } from '@/components/CheckoutLinks/CheckoutLinkRow'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useInfiniteCheckoutLinks } from '@/hooks/polar/checkout_links'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack, useRouter } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { RefreshControl } from 'react-native'

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
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Checkout Links',
          headerRight: () => (
            <Touchable onPress={() => router.push('/checkout-links/new')}>
              <Box
                width={36}
                height={36}
                justifyContent="center"
                alignItems="center"
              >
                <MaterialIcons
                  name="add"
                  size={24}
                  color={theme.colors.monochromeInverted}
                />
              </Box>
            </Touchable>
          ),
        }}
      />
      <CheckoutLinksList />
    </>
  )
}
