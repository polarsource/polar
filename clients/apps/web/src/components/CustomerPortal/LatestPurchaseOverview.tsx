import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OrderStatus } from '../Orders/OrderStatus'
import { OverviewSummaryCard } from './OverviewSummaryCard'

interface LatestPurchaseOverviewProps {
  order: schemas['CustomerOrder']
}

export const LatestPurchaseOverview = ({
  order,
}: LatestPurchaseOverviewProps) => {
  const purchasedOn = new Date(order.created_at).toLocaleDateString('en-US', {
    dateStyle: 'medium',
  })

  return (
    <OverviewSummaryCard
      title="Latest purchase"
      meta={`Purchased · ${purchasedOn}`}
    >
      <Box justifyContent="between" alignItems="center" columnGap="l">
        <Text color="muted">{order.product?.name ?? order.description}</Text>
        <OrderStatus status={order.status} />
      </Box>

      <Box
        marginTop="s"
        paddingTop="s"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        justifyContent="between"
        alignItems="baseline"
        columnGap="l"
      >
        <Text>Total</Text>
        <Text as="span" tabularNums>
          {formatCurrency('compact')(order.total_amount, order.currency)}
        </Text>
      </Box>
    </OverviewSummaryCard>
  )
}
