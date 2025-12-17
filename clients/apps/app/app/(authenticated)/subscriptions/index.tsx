import { Box } from '@/components/Shared/Box'
import { LargeTitle, ScreenHeader } from '@/components/Shared/LargeTitle'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import React, { useContext, useMemo } from 'react'
import { RefreshControl } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const insets = useSafeAreaInsets()
  const offsetY = useSharedValue(0)
  const titleBottomY = useSharedValue(0)
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useSubscriptions(organization?.id, {
      sorting: ['-started_at'],
    })

  const flatData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  const headerHeight = insets.top + 44
  const contentPaddingTop = headerHeight + theme.spacing['spacing-16']

  return (
    <Box flex={1} backgroundColor="background">
      <ScreenHeader
        title="Subscriptions"
        offsetY={offsetY}
        titleBottomY={titleBottomY}
      />
      <FlashList
        data={groupSubscriptionsByDate(flatData)}
        onScroll={(e) => {
          offsetY.value = e.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
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
        ListHeaderComponent={
          <Box marginBottom="spacing-16">
            <LargeTitle
              title="Subscriptions"
              offsetY={offsetY}
              titleBottomY={titleBottomY}
              contentPaddingTop={contentPaddingTop}
            />
          </Box>
        }
        contentContainerStyle={{
          paddingTop: contentPaddingTop,
          paddingHorizontal: theme.spacing['spacing-16'],
          paddingBottom: theme.spacing['spacing-120'],
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
    </Box>
  )
}
