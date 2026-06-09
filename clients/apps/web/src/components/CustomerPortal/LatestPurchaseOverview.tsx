import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { OrderStatus } from '../Orders/OrderStatus'
import { OverviewSummaryCard } from './OverviewSummaryCard'

interface LatestPurchaseOverviewProps {
  order: schemas['CustomerOrder']
}

export const LatestPurchaseOverview = ({
  order,
}: LatestPurchaseOverviewProps) => {
  return (
    <OverviewSummaryCard
      title="Latest Purchase"
      meta={`Purchased — ${new Date(order.created_at).toLocaleDateString(
        'en-US',
        { dateStyle: 'medium' },
      )}`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="dark:text-polar-400 text-gray-600">
          {order.product?.name ?? order.description}
        </span>
        <OrderStatus status={order.status} />
      </div>

      <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Total</span>
          <span className="text-lg font-medium">
            {formatCurrency('compact')(order.total_amount, order.currency)}
          </span>
        </div>
      </div>
    </OverviewSummaryCard>
  )
}
