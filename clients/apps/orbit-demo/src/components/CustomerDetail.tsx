import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  formatCurrency,
  type Customer,
  type CustomerOrder,
  type CustomerSubscription,
} from '@/data/customers'

const STATUS_LABEL: Record<Customer['status'], string> = {
  active: 'Active',
  trial: 'Trial',
  churned: 'Churned',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

export const CustomerDetail = ({ customer }: { customer: Customer }) => (
  <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
    <Header customer={customer} />
    <StatsRow customer={customer} />
    <SubscriptionsSection items={customer.subscriptions} />
    <OrdersSection items={customer.orders} />
  </Box>
)

const Header = ({ customer }: { customer: Customer }) => (
  <Box display="flex" alignItems="center" columnGap="xl">
    <Avatar
      name={customer.name}
      avatar_url={customer.avatarUrl}
      className="size-16"
    />
    <Box display="flex" flexDirection="row" columnGap="l">
      <Text variant="heading-s" as="h1" color="default">
        {customer.name}
      </Text>
      <Text variant="heading-s" color="muted">
        {customer.email}
      </Text>
    </Box>
  </Box>
)

type StatProps = { label: string; value: string; color?: 'default' | 'muted' }

const Stat = ({ label, value, color = 'default' }: StatProps) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="heading-xs" color={color}>
      {value}
    </Text>
  </Box>
)

const StatsRow = ({ customer }: { customer: Customer }) => (
  <Box
    display="grid"
    gridTemplateColumns={{
      base: 'repeat(2, 1fr)',
      md: 'repeat(4, 1fr)',
    }}
    columnGap="xl"
    rowGap="xl"
    paddingVertical="xl"
    borderTopWidth={1}
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Stat label="Status" value={STATUS_LABEL[customer.status]} />
    <Stat
      label="Lifetime Spend"
      value={formatCurrency(customer.totalSpendCents)}
    />
    <Stat label="Orders" value={String(customer.totalOrders)} />
    <Stat label="Customer Since" value={formatDate(customer.createdAt)} />
  </Box>
)

const Section = ({
  title,
  count,
  children,
  empty,
}: {
  title: string
  count: number
  children: React.ReactNode
  empty: string
}) => (
  <Box display="flex" flexDirection="column" rowGap="l">
    <Box display="flex" alignItems="baseline" columnGap="l">
      <Text variant="heading-xs" as="h2" color="default">
        {title}
      </Text>
      <Text variant="heading-xs" color="muted">
        {count}
      </Text>
    </Box>
    {count === 0 ? (
      <Text variant="body" color="muted">
        {empty}
      </Text>
    ) : (
      <Box display="flex" flexDirection="column">
        {children}
      </Box>
    )}
  </Box>
)

const SubscriptionsSection = ({ items }: { items: CustomerSubscription[] }) => (
  <Section title="Subscriptions" count={items.length} empty="No subscriptions.">
    {items.map((sub) => (
      <SubscriptionRow key={sub.id} sub={sub} />
    ))}
  </Section>
)

const SUB_GRID = 'minmax(0, 2fr) 100px 120px minmax(0, 1fr)'

const SubscriptionRow = ({ sub }: { sub: CustomerSubscription }) => (
  <Box
    display="grid"
    gridTemplateColumns={SUB_GRID}
    alignItems="center"
    columnGap="l"
    paddingVertical="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="body" color="default">
      {sub.product}
    </Text>
    <Text
      variant="body"
      color={
        sub.status === 'canceled'
          ? 'muted'
          : sub.status === 'trialing'
            ? 'inherit'
            : 'default'
      }
    >
      {sub.status}
    </Text>
    <Text variant="body" color="default" align="right">
      {sub.amountCents === 0 ? '—' : formatCurrency(sub.amountCents)}
    </Text>
    <Text variant="body" color="muted" align="right">
      {formatDate(sub.startedAt)}
    </Text>
  </Box>
)

const OrdersSection = ({ items }: { items: CustomerOrder[] }) => (
  <Section title="Orders" count={items.length} empty="No orders yet.">
    {items.map((order) => (
      <OrderRow key={order.id} order={order} />
    ))}
  </Section>
)

const ORDER_GRID = 'minmax(0, 2fr) 120px minmax(0, 1fr)'

const OrderRow = ({ order }: { order: CustomerOrder }) => (
  <Box
    display="grid"
    gridTemplateColumns={ORDER_GRID}
    alignItems="center"
    columnGap="l"
    paddingVertical="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="body" color="default">
      {order.product}
    </Text>
    <Text variant="body" color="default" align="right">
      {formatCurrency(order.amountCents)}
    </Text>
    <Text variant="body" color="muted" align="right">
      {formatDate(order.createdAt)}
    </Text>
  </Box>
)
