import { OrderRow } from '@/components/Orders/OrderRow'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { schemas } from '@polar-sh/client'
import { Href, Link } from 'expo-router'
import { PropsWithChildren } from 'react'

interface SectionProps extends PropsWithChildren {
  title: string
  href: Href
}

const Section = ({ title, href, children }: SectionProps) => (
  <Box gap="spacing-24" flexDirection="column" flex={1}>
    <Box flexDirection="row" alignItems="center" justifyContent="space-between">
      <Text variant="title">{title}</Text>
      <Link href={href} asChild>
        <Button size="small" variant="secondary">
          View All
        </Button>
      </Link>
    </Box>
    {children}
  </Box>
)

interface RecentSubscriptionsProps {
  subscriptions: schemas['Subscription'][]
  loading: boolean
}

export const RecentSubscriptions = ({
  subscriptions,
  loading,
}: RecentSubscriptionsProps) => (
  <Section title="Recent Subscriptions" href="/subscriptions">
    {loading ? (
      <Box gap="spacing-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <SubscriptionRow key={i} loading showCustomer />
        ))}
      </Box>
    ) : subscriptions.length > 0 ? (
      <Box gap="spacing-8">
        {subscriptions.map((subscription) => (
          <SubscriptionRow
            key={subscription.id}
            subscription={subscription}
            showCustomer
          />
        ))}
      </Box>
    ) : (
      <EmptyState
        title="No Subscriptions"
        description="No active subscriptions found for this organization"
      />
    )}
  </Section>
)

interface RecentOrdersProps {
  orders: schemas['Order'][]
  loading: boolean
}

export const RecentOrders = ({ orders, loading }: RecentOrdersProps) => (
  <Section title="Recent Orders" href="/orders">
    {loading ? (
      <Box gap="spacing-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <OrderRow key={i} loading showTimestamp />
        ))}
      </Box>
    ) : orders.length > 0 ? (
      <Box gap="spacing-8">
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} showTimestamp />
        ))}
      </Box>
    ) : (
      <EmptyState
        title="No Orders"
        description="No orders found for this organization"
      />
    )}
  </Section>
)
