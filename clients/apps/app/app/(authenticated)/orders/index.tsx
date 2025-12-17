import { OrderRow } from '@/components/Orders/OrderRow'
import { Box } from '@/components/Shared/Box'
import { LargeTitle, ScreenHeader } from '@/components/Shared/LargeTitle'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useOrders } from '@/hooks/polar/orders'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import React, { useContext, useMemo } from 'react'
import { RefreshControl } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const offsetY = useSharedValue(0)
  const titleBottomY = useSharedValue(0)
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useOrders(organization?.id)

  const flatData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  const headerHeight = insets.top + 44
  const contentPaddingTop = headerHeight + theme.spacing['spacing-16']

  return (
    <Box flex={1} backgroundColor="background">
      <ScreenHeader
        title="Orders"
        offsetY={offsetY}
        titleBottomY={titleBottomY}
      />
      <FlashList
        data={groupOrdersByDate(flatData)}
        onScroll={(e) => {
          offsetY.value = e.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
        renderItem={({ item }: { item: schemas['Order'] | string }) => {
          if (typeof item === 'string') {
            return (
              <Text variant="subtitle" paddingVertical="spacing-12">
                {item}
              </Text>
            )
          }

          return (
            <OrderRow
              order={item}
              style={{ marginBottom: theme.spacing['spacing-8'] }}
            />
          )
        }}
        ListHeaderComponent={
          <Box marginBottom="spacing-16">
            <LargeTitle
              title="Orders"
              offsetY={offsetY}
              titleBottomY={titleBottomY}
              contentPaddingTop={contentPaddingTop}
            />
          </Box>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <Box flex={1} justifyContent="center" alignItems="center">
              <Text color="subtext">No Orders</Text>
            </Box>
          )
        }
        contentContainerStyle={{
          paddingTop: contentPaddingTop,
          paddingHorizontal: theme.spacing['spacing-16'],
          paddingBottom: theme.spacing['spacing-120'],
          backgroundColor: theme.colors.background,
          flexGrow: 1,
        }}
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
