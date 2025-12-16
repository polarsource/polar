import { OrderRow } from '@/components/Orders/OrderRow'
import { Avatar } from '@/components/Shared/Avatar'
import { Box } from '@/components/Shared/Box'
import { DetailRow, Details } from '@/components/Shared/Details'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useCustomer } from '@/hooks/polar/customers'
import { useMetrics } from '@/hooks/polar/metrics'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Stack, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useContext, useMemo } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { id } = useLocalSearchParams()
  const theme = useTheme()

  const {
    data: customer,
    refetch: refetchCustomer,
    isRefetching: isCustomerRefetching,
  } = useCustomer(organization?.id, id as string)

  const startDate = useMemo(() => {
    return new Date(customer?.created_at ?? new Date())
  }, [customer])

  const endDate = useMemo(() => {
    return new Date()
  }, [])

  const {
    data: metrics,
    refetch: refetchMetrics,
    isRefetching: isMetricsRefetching,
  } = useMetrics(organization?.id, startDate, endDate, {
    interval: 'month',
    customer_id: [id as string],
  })

  const {
    data: orders,
    refetch: refetchOrders,
    isRefetching: isOrdersRefetching,
  } = useOrders(organization?.id, {
    customer_id: id as string,
  })

  const flatOrders = useMemo(() => {
    return orders?.pages.flatMap((page) => page.items) ?? []
  }, [orders])

  const {
    data: subscriptions,
    refetch: refetchSubscriptions,
    isRefetching: isSubscriptionsRefetching,
  } = useSubscriptions(organization?.id, {
    customer_id: id as string,
    active: null,
  })

  const flatSubscriptions = useMemo(() => {
    return subscriptions?.pages.flatMap((page) => page.items) ?? []
  }, [subscriptions])

  const isRefetching =
    isCustomerRefetching ||
    isSubscriptionsRefetching ||
    isOrdersRefetching ||
    isMetricsRefetching

  const refetch = useCallback(() => {
    return Promise.allSettled([
      refetchCustomer(),
      refetchOrders(),
      refetchMetrics(),
      refetchSubscriptions(),
    ])
  }, [refetchCustomer, refetchOrders, refetchMetrics, refetchSubscriptions])

  return (
    <>
      <Stack.Screen
        options={{
          title: customer?.name ?? 'Customer',
        }}
      />
      <ScrollView
        style={{ flex: 1, padding: theme.spacing['spacing-16'] }}
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
        }
        contentContainerStyle={{
          flexDirection: 'column',
          gap: theme.spacing['spacing-24'],
          paddingBottom: theme.spacing['spacing-48'],
        }}
      >
        <Box flexDirection="column" alignItems="center" gap="spacing-24">
          <Avatar
            image={customer?.avatar_url}
            name={customer?.name ?? customer?.email ?? ''}
            size={120}
          />
          <Box alignItems="center" flexDirection="column" gap="spacing-6">
            <Text variant="titleLarge" style={{ fontWeight: '600' }}>
              {customer?.name ?? '—'}
            </Text>
            <Text color="subtext">{customer?.email}</Text>
          </Box>
        </Box>

        <Box flexDirection="row" gap="spacing-12">
          <Box
            backgroundColor="card"
            padding="spacing-12"
            borderRadius="border-radius-12"
            flex={1}
            gap="spacing-8"
          >
            <Text color="subtext">Revenue</Text>
            <Text>
              {formatCurrencyAndAmount(
                metrics?.periods[metrics?.periods.length - 1]
                  .cumulative_revenue ?? 0,
              )}
            </Text>
          </Box>
          <Box
            backgroundColor="card"
            padding="spacing-12"
            borderRadius="border-radius-12"
            flex={1}
            gap="spacing-8"
          >
            <Text color="subtext">First Seen</Text>
            <Text>
              {new Date(customer?.created_at ?? '').toLocaleDateString(
                'en-US',
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                },
              )}
            </Text>
          </Box>
        </Box>

        <Box>
          <Details>
            <DetailRow
              label="Address"
              value={customer?.billing_address?.line1}
            />
            <DetailRow
              label="Address 2"
              value={customer?.billing_address?.line2}
            />
            <DetailRow label="City" value={customer?.billing_address?.city} />
            <DetailRow label="State" value={customer?.billing_address?.state} />
            <DetailRow
              label="Postal Code"
              value={customer?.billing_address?.postal_code}
            />
            <DetailRow
              label="Country"
              value={customer?.billing_address?.country}
            />
          </Details>
        </Box>

        {customer?.metadata && Object.keys(customer.metadata).length > 0 ? (
          <Box>
            <Details>
              {Object.entries(customer.metadata).map(([key, value]) => (
                <DetailRow key={key} label={key} value={String(value)} />
              ))}
            </Details>
          </Box>
        ) : null}

        <Box gap="spacing-16" flexDirection="column" flex={1}>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text variant="titleLarge">Subscriptions</Text>
          </Box>
          {flatSubscriptions.length > 0 ? (
            <Box gap="spacing-8">
              {flatSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                />
              ))}
            </Box>
          ) : (
            <EmptyState
              title="No Subscriptions"
              description="No subscriptions found for this customer"
            />
          )}
        </Box>

        <Box gap="spacing-16" flexDirection="column" flex={1}>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text variant="titleLarge">Orders</Text>
          </Box>
          {flatOrders.length > 0 ? (
            <Box gap="spacing-8">
              {flatOrders.map((order) => (
                <OrderRow key={order.id} order={order} showTimestamp />
              ))}
            </Box>
          ) : (
            <EmptyState
              title="No Orders"
              description="No orders found for this customer"
            />
          )}
        </Box>
      </ScrollView>
    </>
  )
}
