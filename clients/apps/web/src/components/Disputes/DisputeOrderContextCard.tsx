import { OrderStatus } from '@/components/Orders/OrderStatus'
import { ContextCard } from '@/components/Shared/ContextCard'
import { DetailRow } from '@/components/Shared/DetailRow'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

const format = formatCurrency('accounting')

export const DisputeOrderContextCard = ({
  organization,
  order,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
}) => (
  <ContextCard>
    <Text variant="heading-xxs" as="h3">
      Order
    </Text>
    <Box flexDirection="column">
      <DetailRow label="Product" value={order.product?.name ?? '—'} />
      <DetailRow
        label="Status"
        value={<OrderStatus size="small" status={order.status} />}
      />
      <DetailRow
        label="Amount"
        value={format(order.total_amount, order.currency)}
      />
      <DetailRow
        label="Date"
        value={<FormattedDateTime datetime={order.created_at} />}
      />
    </Box>
    <Button className="w-full" size="default" variant="secondary" asChild>
      <Link href={`/dashboard/${organization.slug}/sales/${order.id}`}>
        View order
      </Link>
    </Button>
  </ContextCard>
)
