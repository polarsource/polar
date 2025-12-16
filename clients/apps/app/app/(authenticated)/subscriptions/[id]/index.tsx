import { CustomerRow } from '@/components/Customers/CustomerRow'
import { OrderRow } from '@/components/Orders/OrderRow'
import { ProductRow } from '@/components/Products/ProductRow'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { DetailRow, Details } from '@/components/Shared/Details'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Pill } from '@/components/Shared/Pill'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscription } from '@/hooks/polar/subscriptions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import * as Clipboard from 'expo-clipboard'
import { Link, Stack, useLocalSearchParams } from 'expo-router'
import React, { useContext, useMemo } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

const statusColors = {
  active: 'green',
  canceled: 'red',
  incomplete: 'yellow',
  incomplete_expired: 'red',
  past_due: 'red',
  trialing: 'blue',
  unpaid: 'yellow',
} as const

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { id } = useLocalSearchParams()
  const theme = useTheme()

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string)

  const { data: subscriptionOrders } = useOrders(organization?.id, {
    customer_id: subscription?.customer.id,
    product_id: subscription?.product.id,
    subscription_id: id,
  })

  const flatSubscriptionOrders = useMemo(() => {
    return subscriptionOrders?.pages.flatMap((page) => page.items) ?? []
  }, [subscriptionOrders])

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: 'Subscription',
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
        gap: theme.spacing['spacing-16'],
        paddingBottom: theme.spacing['spacing-48'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: 'Subscription',
        }}
      />

      <Box flexDirection="row" gap="spacing-12">
        <Touchable
          style={{
            flexDirection: 'column',
            gap: theme.spacing['spacing-4'],
            borderRadius: theme.borderRadii['border-radius-12'],
            padding: theme.spacing['spacing-12'],
            backgroundColor: theme.colors.card,
            flex: 1,
            width: '50%',
          }}
          onPress={() => {
            Clipboard.setStringAsync(subscription.id)
          }}
          activeOpacity={0.6}
        >
          <Text color="subtext">#</Text>
          <Text
            variant="bodyMedium"
            style={{ textTransform: 'uppercase' }}
            numberOfLines={1}
          >
            {subscription.id.split('-').pop()?.slice(-6, -1)}
          </Text>
        </Touchable>
        <Box
          flexDirection="column"
          gap="spacing-4"
          borderRadius="border-radius-12"
          padding="spacing-12"
          backgroundColor="card"
          flex={1}
          width="50%"
        >
          <Text color="subtext">Date</Text>
          <Text variant="bodyMedium">
            {new Date(subscription.created_at).toLocaleDateString('en-US', {
              dateStyle: 'medium',
            })}
          </Text>
        </Box>
      </Box>

      <CustomerRow customer={subscription.customer} />

      <ProductRow product={subscription.product} />

      <Box>
        <Details>
          <DetailRow
            label="Status"
            value={
              <Pill
                color={statusColors[subscription.status]}
                textStyle={{ fontSize: 14 }}
              >
                {subscription.status.split('_').join(' ')}
              </Pill>
            }
            valueStyle={{ textTransform: 'capitalize' }}
          />
          {subscription.status === 'canceled' ? (
            <DetailRow
              label="Cancellation Reason"
              value={subscription.customer_cancellation_reason}
            />
          ) : null}
          {subscription.status === 'canceled' ? (
            <DetailRow
              label="Cancels At"
              value={
                subscription.cancel_at_period_end
                  ? new Date(
                      subscription.current_period_end ?? '',
                    ).toLocaleDateString('en-US', {
                      dateStyle: 'medium',
                    })
                  : new Date(subscription.canceled_at ?? '').toLocaleDateString(
                      'en',
                      {
                        dateStyle: 'medium',
                      },
                    )
              }
            />
          ) : null}
          <DetailRow
            label="Recurring Interval"
            value={subscription.recurring_interval.split('_').join(' ')}
            valueStyle={{ textTransform: 'capitalize' }}
          />
          <DetailRow
            label="Start Date"
            value={new Date(subscription.started_at ?? '').toLocaleDateString(
              'en',
              {
                dateStyle: 'medium',
              },
            )}
          />
          <DetailRow
            label="Renewal Date"
            value={new Date(
              subscription.current_period_end ?? '',
            ).toLocaleDateString('en-US', {
              dateStyle: 'medium',
            })}
          />
          {subscription.ends_at ? (
            <DetailRow
              label="End Date"
              value={new Date(subscription.ends_at ?? '').toLocaleDateString(
                'en',
                {
                  dateStyle: 'medium',
                },
              )}
            />
          ) : null}
        </Details>
      </Box>

      {subscription.metadata
        ? Object.keys(subscription.metadata).length > 0 && (
            <Box>
              <Details>
                {Object.entries(subscription.metadata).map(([key, value]) => (
                  <DetailRow key={key} label={key} value={String(value)} />
                ))}
              </Details>
            </Box>
          )
        : null}

      {subscription.status === 'active' ? (
        <Box flexDirection="column" gap="spacing-8">
          <Link key={'update'} href={`/subscriptions/${id}/update`} asChild>
            <Button>Update Subscription</Button>
          </Link>
          <Link key={'cancel'} href={`/subscriptions/${id}/cancel`} asChild>
            <Button variant="secondary">Cancel Subscription</Button>
          </Link>
        </Box>
      ) : null}

      <Box gap="spacing-16" paddingVertical="spacing-12">
        <Box
          flexDirection="row"
          alignItems="center"
          gap="spacing-8"
          justifyContent="space-between"
        >
          <Text variant="title">Subscription Orders</Text>
          <Text variant="title" color="subtext">
            {flatSubscriptionOrders.length}
          </Text>
        </Box>

        {flatSubscriptionOrders.length > 0 ? (
          <>
            {flatSubscriptionOrders.map((order) => (
              <OrderRow key={order.id} order={order} showTimestamp />
            ))}
          </>
        ) : (
          <EmptyState
            title="No Subscription Orders"
            description="This Subscription has no associated orders"
          />
        )}
      </Box>
    </ScrollView>
  )
}
