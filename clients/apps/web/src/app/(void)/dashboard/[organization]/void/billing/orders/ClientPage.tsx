'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useOrders(organization.id, {
    limit: 25,
    sorting: ['-created_at'],
  })

  const orders = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection flush label="Billing" meta={`${orders.length} orders`}>
        {orders.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {orders.map((order) => (
              <Grid
                key={order.id}
                templateColumns={{ base: '1fr auto', md: '1fr 2fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xxs" monospace color="muted">
                  {shortDate(order.created_at)}
                </Text>
                <Text variant="heading-xs" truncate>
                  {order.customer.name ??
                    order.customer.email ??
                    order.customer.id.slice(0, 8)}
                </Text>
                <Text variant="heading-xs" align="right" tabularNums>
                  {formatCurrency('standard')(order.net_amount, 'usd')}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-m" color="muted">
            No orders yet
          </Text>
        )}
      </VoidSection>
    </Box>
  )
}
