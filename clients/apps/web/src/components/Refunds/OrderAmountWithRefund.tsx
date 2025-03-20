import { schemas } from '@polar-sh/client'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'

export const OrderAmountWithRefund = ({
  order,
}: {
  order: schemas['Order']
}) => {
  return (
    <div className="flex flex-row gap-x-2">
      <span>{formatCurrencyAndAmount(order.net_amount, order.currency)}</span>
      {order.status == 'pending' && (
        <Pill color="yellow" className="flex flex-row">
          <span>Pending</span>
        </Pill>
      )}
      {order.status == 'refunded' && (
        <Pill color="blue" className="flex flex-row">
          <span>Refunded</span>
        </Pill>
      )}
      {order.status == 'partially_refunded' && (
        <Pill color="purple" className="flex flex-row">
          <span>Partial Refund</span>
        </Pill>
      )}
    </div>
  )
}
