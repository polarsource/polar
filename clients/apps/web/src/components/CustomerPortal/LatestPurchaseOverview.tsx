import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OrderStatus } from '../Orders/OrderStatus'
import { PortalCard, PortalSection, PortalText } from './PortalPrimitives'

interface LatestPurchaseOverviewProps {
  order: schemas['CustomerOrder']
}

export const LatestPurchaseOverview = ({
  order,
}: LatestPurchaseOverviewProps) => {
  return (
    <PortalSection title="Latest purchase">
      <PortalCard>
        <Box justifyContent="between" alignItems="start" columnGap="l">
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Text variant="heading-xxs" as="h3">
              {order.product?.name ?? order.description}
            </Text>
            <PortalText tone="secondary" className="text-sm">
              Purchased{' '}
              {new Date(order.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </PortalText>
          </Box>
          <OrderStatus status={order.status} size="small" />
        </Box>
        <Text variant="heading-xs" as="p" tabularNums>
          {formatCurrency('compact')(order.total_amount, order.currency)}
        </Text>
      </PortalCard>
    </PortalSection>
  )
}
