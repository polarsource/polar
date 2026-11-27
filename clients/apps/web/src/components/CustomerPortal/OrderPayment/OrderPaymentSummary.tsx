import { type schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { hasCompleteBillingAddress } from '../BillingDetailsFields'
import {
  PortalDivider,
  PortalRow,
  PortalRows,
  PortalText,
} from '../PortalPrimitives'
import { OrderPaymentCard } from './OrderPaymentCard'

export const OrderPaymentSummary = ({
  order,
}: {
  order: schemas['CustomerOrder']
}) => {
  const format = (amount: number) =>
    formatCurrency('compact')(amount, order.currency)
  const isTaxCalculated =
    order.status !== 'draft' || hasCompleteBillingAddress(order.billing_address)

  return (
    <OrderPaymentCard rowGap="2xl">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-l" as="h1">
          {format(order.due_amount)}
        </Text>
        <PortalText tone="secondary">
          {isTaxCalculated ? 'Due today' : 'Due today, plus tax'}
        </PortalText>
      </Box>

      <Box flexDirection="column" rowGap="l">
        <PortalRows>
          {order.items.map((item) => (
            <PortalRow
              key={item.id}
              label={item.label}
              value={format(item.amount)}
              numeric
            />
          ))}
        </PortalRows>
        <PortalDivider />
        <PortalRows>
          <PortalRow
            label="Subtotal"
            value={format(order.subtotal_amount)}
            numeric
          />
          {order.discount_amount > 0 && (
            <PortalRow
              label="Discount"
              value={format(-order.discount_amount)}
              numeric
            />
          )}
          {isTaxCalculated && (
            <PortalRow label="Tax" value={format(order.tax_amount)} numeric />
          )}
          {order.applied_balance_amount !== 0 && (
            <PortalRow
              label="Account balance"
              value={format(order.applied_balance_amount)}
              numeric
            />
          )}
        </PortalRows>
        {isTaxCalculated ? (
          <PortalRow
            label="Total due today"
            value={format(order.due_amount)}
            emphasis
            numeric
          />
        ) : (
          <PortalText tone="secondary" className="text-sm">
            Tax is calculated once you enter your billing address.
          </PortalText>
        )}
      </Box>
    </OrderPaymentCard>
  )
}
