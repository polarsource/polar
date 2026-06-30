import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { formatCurrency } from '@/data/customers'
import type { ProductCustomer, ProductPlan } from '@/data/products'

const STATUS_LABEL: Record<ProductCustomer['status'], string> = {
  active: 'Active',
  trialing: 'Trialing',
  canceled: 'Canceled',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

const formatNumber = (value: number) => value.toLocaleString('en-US')

export const ProductDetail = ({ product }: { product: ProductPlan }) => (
  <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
    <Header product={product} />
    <StatsRow product={product} />
    <CustomersSection items={product.customers} />
  </Box>
)

const Header = ({ product }: { product: ProductPlan }) => {
  const Icon = product.icon
  const price =
    product.priceCents === 0
      ? product.priceUnit
      : `${formatCurrency(product.priceCents)} ${product.priceUnit}`
  return (
    <Box display="flex" alignItems="center" columnGap="xl">
      <Box color="text-primary" display="inline-flex">
        <Icon size={40} />
      </Box>
      <Box display="flex" flexDirection="row" columnGap="l" alignItems="baseline">
        <Text variant="heading-s" as="h1" color="default">
          {product.name}
        </Text>
        <Text variant="heading-s" color="muted">
          {price}
        </Text>
      </Box>
    </Box>
  )
}

type StatProps = { label: string; value: string }

const Stat = ({ label, value }: StatProps) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="heading-xs" color="default">
      {value}
    </Text>
  </Box>
)

const StatsRow = ({ product }: { product: ProductPlan }) => (
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
    <Stat label="Type" value={product.type} />
    <Stat
      label="Lifetime Revenue"
      value={formatCurrency(product.metrics.revenueCents)}
    />
    <Stat label="MRR" value={formatCurrency(product.metrics.mrrCents)} />
    <Stat
      label="Active Subscribers"
      value={formatNumber(product.metrics.activeSubscribers)}
    />
  </Box>
)

const CustomersSection = ({ items }: { items: ProductCustomer[] }) => (
  <Box display="flex" flexDirection="column" rowGap="l">
    <Box display="flex" alignItems="baseline" columnGap="l">
      <Text variant="heading-xs" as="h2" color="default">
        Customers
      </Text>
      <Text variant="heading-xs" color="muted">
        {items.length}
      </Text>
    </Box>
    {items.length === 0 ? (
      <Text variant="body" color="muted">
        No customers on this plan yet.
      </Text>
    ) : (
      <Box display="flex" flexDirection="column">
        {items.map((customer) => (
          <CustomerRow key={customer.customerId} customer={customer} />
        ))}
      </Box>
    )}
  </Box>
)

const CUSTOMER_GRID =
  '40px minmax(0, 2fr) minmax(0, 1.5fr) 100px 100px minmax(0, 1fr)'

const CustomerRow = ({ customer }: { customer: ProductCustomer }) => (
  <Link
    href={`/customers/${customer.customerId}`}
    style={{ textDecoration: 'none', color: 'inherit' }}
  >
    <Box
      display="grid"
      gridTemplateColumns={CUSTOMER_GRID}
      alignItems="center"
      columnGap="l"
      paddingVertical="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      cursor="pointer"
    >
      <Avatar
        name={customer.name}
        avatar_url={customer.avatarUrl}
        className="size-8"
      />
      <Text variant="body" color="default">
        {customer.name}
      </Text>
      <Text variant="body" color="muted">
        {customer.email}
      </Text>
      <Text variant="body" color="muted">
        {STATUS_LABEL[customer.status]}
      </Text>
      <Text variant="body" color="default" align="right">
        {customer.amountCents === 0
          ? '—'
          : formatCurrency(customer.amountCents)}
      </Text>
      <Text variant="body" color="muted" align="right">
        {formatDate(customer.startedAt)}
      </Text>
    </Box>
  </Link>
)
