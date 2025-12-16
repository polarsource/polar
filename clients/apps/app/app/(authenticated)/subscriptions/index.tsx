import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { RefreshControl } from 'react-native'

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
  const theme = useTheme()
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
      <FlashList
        data={groupSubscriptionsByDate(flatData)}
        renderItem={({ item }: { item: schemas['Subscription'] | string }) => {
          if (typeof item === 'string') {
            return (
              <Text paddingVertical="spacing-12" variant="subtitle">
                {item}
              </Text>
            )
          }

          return (
            <SubscriptionRow
              subscription={item}
              style={{ marginBottom: theme.spacing['spacing-8'] }}
              showCustomer
            />
          )
        }}
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
          backgroundColor: theme.colors.background,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          isLoading ? null : (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Text color="subtext">No Subscriptions</Text>
            </Box>
          )
        }
        ItemSeparatorComponent={() => (
          <Box style={{ height: theme.dimension['dimension-1'] }} />
        )}
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
