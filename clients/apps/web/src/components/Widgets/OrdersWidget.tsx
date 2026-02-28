import { useOrders } from '@/hooks/queries/orders'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { WidgetContainer } from './WidgetContainer'

const orderStatusBadgeClassNames = (order: schemas['Order']) => {
  switch (order.status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950'
    case 'pending':
      return 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950'
    case 'refunded':
    case 'partially_refunded':
      return 'bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400'
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
        'dark:bg-polar-800 flex flex-col gap-y-1 rounded-lg border-none bg-gray-50 transition-opacity hover:opacity-60',
      )}
    >
      <CardHeader className="dark:text-polar-500 flex flex-row items-baseline justify-between bg-transparent p-4 pt-2 pb-0 text-sm text-gray-500">
        <span>{displayDate}</span>
        <Status
          className={twMerge(
            'px-1.5 py-0.5 text-xs capitalize',
            orderStatusBadgeClassNames(order),
          )}
          status={order.status.split('_').join(' ')}
        />
      </CardHeader>
      <CardContent className="flex flex-row justify-between gap-x-4 p-4 pt-0 pb-3">
        <h3 className="min-w-0 truncate">{order.description}</h3>
        <span className="">
          {formatCurrency('compact')(order.net_amount, order.currency)}
        </span>
      </CardContent>
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
      className={twMerge('min-h-80 md:min-h-fit', className)}
    >
      {(orders.data?.items.length ?? 0) > 0 ? (
        <div className="flex h-full flex-col gap-y-2 overflow-y-auto">
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
        <div className="dark:text-polar-600 flex h-full flex-col items-center justify-center gap-y-6 p-6 text-gray-500">
          <ShoppingCartOutlined
            className="dark:text-polar-700 text-gray-400"
            fontSize="large"
          />
          <h3>No orders found</h3>
        </div>
      )}
    </WidgetContainer>
  )
}
