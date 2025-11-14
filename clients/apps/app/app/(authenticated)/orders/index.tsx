import { OrderRow } from '@/components/Orders/OrderRow'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useOrders } from '@/hooks/polar/orders'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { Stack } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

const groupOrdersByDate = (orders: schemas['Order'][]) => {
  if (!orders?.length) return []

  const result: (schemas['Order'] | string)[] = []
  let currentDate: string | null = null

  orders.forEach((order) => {
    const orderDate = new Date(order.created_at)
    const wasLastYear = orderDate.getFullYear() < new Date().getFullYear()
    const dateString = orderDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: wasLastYear ? 'numeric' : undefined,
    })

    if (dateString !== currentDate) {
      currentDate = dateString
      result.push(dateString)
    }

    result.push(order)
  })

  return result
}

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useOrders(organization?.id)

  const flatData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  return (
    <>
      <Stack.Screen options={{ title: 'Orders' }} />
      <FlatList
        data={groupOrdersByDate(flatData)}
        renderItem={({ item }: { item: schemas['Order'] | string }) => {
          if (typeof item === 'string') {
            return (
              <ThemedText
                style={{
                  paddingVertical: 12,
                  fontSize: 18,
                }}
              >
                {item}
              </ThemedText>
            )
          }

          return <OrderRow order={item} style={{ marginBottom: 8 }} />
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
                No Orders
              </ThemedText>
            </View>
          )
        }
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
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
