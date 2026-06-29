import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import { ContextCard } from '@/components/Shared/ContextCard'
import { DetailRow } from '@/components/Shared/DetailRow'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

const format = formatCurrency('accounting')

export const DisputeContextView = ({
  organization,
  order,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
}) => (
  <div className="flex flex-col gap-4">
    <CustomerContextView
      organization={organization}
      customer={order.customer}
    />
    <ContextCard>
      <h3 className="text-lg">Order</h3>
      <div className="flex flex-col">
        <DetailRow label="Product" value={order.product?.name ?? '—'} />
        <DetailRow
          label="Status"
          value={<OrderStatus status={order.status} />}
        />
        <DetailRow
          label="Subtotal"
          value={format(order.subtotal_amount, order.currency)}
        />
        <DetailRow
          label="Discount"
          value={
            order.discount_amount
              ? format(-order.discount_amount, order.currency)
              : '—'
          }
        />
        <DetailRow
          label="Net amount"
          value={format(order.net_amount, order.currency)}
        />
        <DetailRow
          label="Tax"
          value={format(order.tax_amount, order.currency)}
        />
        <DetailRow
          label="Total"
          value={format(order.total_amount, order.currency)}
        />
        <DetailRow
          label="Date"
          value={<FormattedDateTime datetime={order.created_at} />}
        />
        <DetailRow label="Invoice" value={order.invoice_number ?? '—'} />
      </div>
    </ContextCard>
  </div>
)
