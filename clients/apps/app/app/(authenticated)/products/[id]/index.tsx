import { Box as MetricsBox } from '@/components/Metrics/Box'
import { OrderRow } from '@/components/Orders/OrderRow'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { useOrders } from '@/hooks/polar/orders'
import { useProduct, useProductUpdate } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useContext, useMemo } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

export interface ProductFullMediasMixin {
  full_medias: schemas['ProductMediaFileRead'][]
}

export default function Index() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)

  const {
    data: product,
    refetch,
    isRefetching,
  } = useProduct(organization?.id, id as string)

  const now = useMemo(() => new Date(), [])

  const { data: metrics } = useMetrics(
    organization?.id,
    new Date(organization?.created_at ?? ''),
    now,
    {
      product_id: id as string,
      interval: 'month',
    },
  )

  const { data: latestProductOrders } = useOrders(organization?.id, {
    product_id: id as string,
    limit: 3,
  })

  const flatLatestProductOrders = latestProductOrders?.pages.flatMap(
    (page) => page.items,
  )

  const updateProduct = useProductUpdate(organization?.id, id as string)

  const { error: mutationError } = updateProduct

  if (mutationError) {
    throw mutationError
  }

  if (!product) {
    return (
      <Stack.Screen
        options={{
          title: 'Product',
        }}
      />
    )
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        flexDirection: 'column',
        gap: theme.spacing['spacing-32'],
        paddingBottom: theme.spacing['spacing-48'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: product.name,
        }}
      />

      {product.is_archived ? (
        <Banner
          title="This product is archived"
          description="This product cannot be sold to new customers."
        />
      ) : null}

      <Box flexDirection="row" gap="spacing-16">
        <MetricsBox
          label="Orders"
          value={(
            metrics?.periods.reduce(
              (acc, period) => acc + (period.orders ?? 0),
              0,
            ) ?? 0
          ).toString()}
        />
        <MetricsBox
          label="Revenue"
          value={formatCurrency('statistics')(
            metrics?.periods[metrics?.periods.length - 1].cumulative_revenue ??
              0,
            'usd',
          )}
        />
      </Box>

      <Box flexDirection="column" gap="spacing-16">
        <Text variant="title">Latest orders</Text>
        <Box flexDirection="column" gap="spacing-8">
          {(flatLatestProductOrders?.length ?? 0) > 0 ? (
            flatLatestProductOrders?.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))
          ) : (
            <EmptyState
              title="No orders found"
              description="No orders found for this product"
            />
          )}
        </Box>
      </Box>
    </ScrollView>
  )
}
