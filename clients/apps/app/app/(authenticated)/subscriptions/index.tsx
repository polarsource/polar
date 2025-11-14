import { ThemedText } from '@/components/Shared/ThemedText'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { Stack } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

const groupSubscriptionsByDate = (subscriptions: schemas['Subscription'][]) => {
  if (!subscriptions?.length) return []

  const result: (schemas['Subscription'] | string)[] = []
  let currentDate: string | null = null

  subscriptions.forEach((subscription) => {
    const subscriptionDate = new Date(subscription.created_at)
    const wasLastYear =
      subscriptionDate.getFullYear() < new Date().getFullYear()
    const dateString = subscriptionDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: wasLastYear ? 'numeric' : undefined,
    })

    if (dateString !== currentDate) {
      currentDate = dateString
      result.push(dateString)
    }

    result.push(subscription)
  })

  return result
}

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useSubscriptions(organization?.id, {
      sorting: ['-started_at'],
    })

  const flatData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  return (
    <>
      <Stack.Screen options={{ title: 'Subscriptions' }} />
      <FlatList
        data={groupSubscriptionsByDate(flatData)}
        renderItem={({ item }: { item: schemas['Subscription'] | string }) => {
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

          return (
            <SubscriptionRow
              subscription={item}
              style={{ marginBottom: 8 }}
              showCustomer
            />
          )
        }}
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
          flexGrow: 1,
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
                No Subscriptions
              </ThemedText>
            </View>
          )
        }
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
