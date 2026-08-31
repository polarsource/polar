'use client'

import { identityKind } from '@/components/Void/identityInsights'
import { BarcodeChart } from '@/components/Void/BarcodeChart'
import { VoidCell, VoidGrid } from '@/components/Void/VoidGrid'
import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useCustomer } from '@/hooks/queries/customers'
import { useEvents } from '@/hooks/queries/events'
import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { differenceInCalendarDays, subDays } from 'date-fns'
import Link from 'next/link'
import { useContext, useMemo } from 'react'

const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const eventTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export default function ClientPage({ customerId }: { customerId: string }) {
  const { organization } = useContext(OrganizationContext)
  const { data: customer } = useCustomer(customerId)
  const { data: ordersData } = useOrders(organization.id, {
    customer_id: customerId,
    limit: 100,
    sorting: ['-created_at'],
  })
  const { data: eventsData } = useEvents(organization.id, {
    customer_id: customerId,
    limit: 8,
    sorting: ['-timestamp'],
  })
  const { data: customerMetersData } = useCustomerMeters(organization.id, {
    customer_id: customerId,
  })

  const since = useMemo(() => subDays(new Date(), 29), [])
  const orders = useMemo(() => ordersData?.items ?? [], [ordersData])

  const recentOrders = useMemo(
    () => orders.filter((order) => new Date(order.created_at) >= since),
    [orders, since],
  )
  const spend30d = recentOrders.reduce(
    (sum, order) => sum + order.net_amount,
    0,
  )
  const spendFetched = orders.reduce((sum, order) => sum + order.net_amount, 0)

  const cadence = useMemo(() => {
    const buckets = Array.from({ length: 30 }, () => 0)
    for (const order of recentOrders) {
      const day = differenceInCalendarDays(new Date(order.created_at), since)
      if (day >= 0 && day < 30) buckets[day] += order.net_amount
    }
    return buckets
  }, [recentOrders, since])

  const events = eventsData?.items ?? []
  const customerMeters = customerMetersData?.items ?? []

  if (!customer) {
    return (
      <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
        <Text variant="heading-m" color="muted">
          Loading identity
        </Text>
      </Box>
    )
  }

  const stats = [
    {
      label: 'Spend / 30 days',
      value: formatCurrency('standard')(spend30d, 'usd'),
    },
    {
      label: 'Spend / all time',
      value: formatCurrency('standard')(spendFetched, 'usd'),
    },
    { label: 'Orders / 30 days', value: `${recentOrders.length}` },
    { label: 'First seen', value: shortDate(customer.created_at) },
  ]

  return (
    <Box
      as="main"
      flexDirection="column"
      paddingTop="5xl"
      paddingBottom="5xl"
      flexGrow={1}
      rowGap="4xl"
    >
      <Box flexDirection="column" rowGap="l">
        <Link href={`/dashboard/${organization.slug}/void/usage/identities`}>
          <Text variant="heading-xxs" color="muted">
            Identities
          </Text>
        </Link>
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-xxs" color="muted">
            {`${identityKind(customer)} / ${customer.id.slice(0, 8)}`}
          </Text>
          <Text variant="heading-2xl" as="h2">
            {customer.name ?? customer.email}
          </Text>
        </Box>
      </Box>
      <VoidGrid>
        {stats.map((stat) => (
          <VoidCell key={stat.label} minHeight={140}>
            <Box
              flexDirection="column"
              justifyContent="between"
              flexGrow={1}
              rowGap="l"
            >
              <Text variant="heading-xxs">{stat.label}</Text>
              <Text variant="heading-m">{stat.value}</Text>
            </Box>
          </VoidCell>
        ))}
      </VoidGrid>
      {customerMeters.length > 0 ? (
        <Box flexDirection="column" rowGap="2xl">
          <Text variant="heading-xxs">Meters</Text>
          <VoidGrid>
            {customerMeters.map((customerMeter) => (
              <VoidCell key={customerMeter.id} minHeight={180}>
                <Box
                  flexDirection="column"
                  justifyContent="between"
                  flexGrow={1}
                  rowGap="2xl"
                >
                  <Text variant="heading-xxs" color="muted">
                    {customerMeter.meter.name}
                  </Text>
                  <Box flexDirection="column" rowGap="s">
                    <Text variant="heading-l" tabularNums>
                      {customerMeter.consumed_units.toLocaleString('en-US')}
                    </Text>
                    <Text variant="heading-xxs" color="muted">
                      {`credited ${customerMeter.credited_units.toLocaleString('en-US')} / balance ${customerMeter.balance.toLocaleString('en-US')}`}
                    </Text>
                  </Box>
                </Box>
              </VoidCell>
            ))}
          </VoidGrid>
        </Box>
      ) : null}
      <Box flexDirection="column" rowGap="2xl">
        <Text variant="heading-xxs">Spend cadence / 30 days</Text>
        <BarcodeChart values={cadence} height={100} />
      </Box>
      <Box flexDirection="column" rowGap="2xl">
        <Text variant="heading-xxs">Event trail</Text>
        {events.length > 0 ? (
          <Box flexDirection="column" rowGap="l">
            {events.map((event) => (
              <Grid
                key={event.id}
                templateColumns={{ base: '1fr auto', md: '1fr 2fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xxs" monospace color="muted">
                  {eventTime(event.timestamp)}
                </Text>
                <Text variant="heading-xs">{event.name}</Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {event.source}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-xxs" color="muted">
            No events recorded for this identity
          </Text>
        )}
      </Box>
    </Box>
  )
}
