import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button } from '@polar-sh/orbit'
import { Card } from '@polar-sh/ui/components/atoms/Card'
import { Status, type StatusColor } from '@polar-sh/orbit'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { WidgetContainer } from './WidgetContainer'

const orderStatusBadgeColor = (
  order: schemas['Order'],
): StatusColor | undefined => {
  switch (order.status) {
    case 'paid':
      return 'green'
    case 'pending':
      return 'yellow'
    case 'refunded':
    case 'partially_refunded':
      return 'purple'
  }
}

interface OrderCardProps {
  className?: string
  order: schemas['Order']
}

const OrderCard = ({ className, order }: OrderCardProps) => {
  const createdAtDate = new Date(order.created_at)

  const displayDate = createdAtDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
  })

  return (
    <Card
      className={twMerge(
        className,
        'dark:bg-polar-800 flex flex-col gap-y-1 rounded-xl border-none bg-gray-50 px-4 py-4 transition-opacity hover:opacity-60',
      )}
    >
      <div className="dark:text-polar-500 flex flex-row items-baseline justify-between text-sm text-gray-500">
        <span>{displayDate}</span>
        <Status
          color={orderStatusBadgeColor(order)}
          size="small"
          status={order.status
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}
        />
      </div>
      <div className="flex flex-row justify-between gap-x-4">
        <h3 className="min-w-0 truncate">{order.description}</h3>
        <span>
          {formatCurrency('standard')(order.net_amount, order.currency)}
        </span>
      </div>
    </Card>
  )
}

export interface OrdersWidgetProps {
  className?: string
}

export const OrdersWidget = ({ className }: OrdersWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)

  const orders = useOrders(org.id, { limit: 10, sorting: ['-created_at'] })

  return (
    <WidgetContainer
      title="Latest Orders"
      action={
        <Link href={`/dashboard/${org.slug}/sales`}>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full border-none"
          >
            View All
          </Button>
        </Link>
      }
      className={twMerge('min-h-80', className)}
    >
      {(orders.data?.items.length ?? 0) > 0 ? (
        <div className="flex flex-col gap-y-2 pb-6">
          {orders.data?.items?.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/${org.slug}/sales/${order.id}`}
            >
              <OrderCard order={order} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="dark:bg-polar-800 mb-6 flex flex-1 flex-col items-center justify-center gap-y-2 rounded-lg bg-gray-50 p-8 text-center">
          <h3>No orders found</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Your most recent orders will appear here.
          </p>
        </div>
      )}
    </WidgetContainer>
  )
}
