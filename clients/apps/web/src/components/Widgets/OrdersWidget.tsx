import { useOrders } from '@/hooks/queries/orders'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ShoppingCartOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrderCardProps {
  className?: string
  order: schemas['Order']
}

const OrderCard = ({ className, order }: OrderCardProps) => {
  const createdAtDate = new Date(order.created_at)

  const { organization: org } = useContext(MaintainerOrganizationContext)

  const displayDate = createdAtDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const displayTime = createdAtDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  })

  return (
    <Card className={className}>
      <CardHeader className="dark:text-polar-500 flex flex-row items-baseline justify-between bg-transparent pb-6 text-sm text-gray-400">
        <span>{displayDate}</span>
        <span>{displayTime}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-1 pb-6 text-lg">
        <h3>{order.product.name}</h3>
        <span className="dark:text-polar-500 text-gray-400">
          ${getCentsInDollarString(order.amount, false)}
        </span>
      </CardContent>
      <Link href={`/dashboard/${org.slug}/customers/${order.customer.id}`}>
        <CardFooter className="dark:bg-polar-900 m-2 flex flex-row items-center gap-x-4 rounded-3xl bg-white p-4">
          <Avatar
            className="h-10 w-10"
            name={order.customer.name || order.customer.email}
            avatar_url={order.customer.avatar_url}
          />
          <div className="flex flex-col text-sm">
            <span>{order.customer.name ?? '—'}</span>
            <span className="dark:text-polar-500 text-gray-400">
              {order.customer.email}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  )
}

export interface OrdersWidgetProps {
  className?: string
}

export const OrdersWidget = ({ className }: OrdersWidgetProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const orders = useOrders(org.id, { limit: 3, sorting: ['-created_at'] })

  const stackingClassNames = [
    'scale-90',
    'top-1/2 -translate-y-1/2 scale-[.95]',
    'bottom-0',
  ]

  return (
    <div className={twMerge('hidden h-80 md:block', className)}>
      {(orders.data?.items.length ?? 0) > 0 ? (
        <div className="relative h-full">
          {orders.data?.items
            ?.slice()
            .reverse()
            .map((order, index) => (
              <Link
                key={order.id}
                href={`/dashboard/${org.slug}/sales/${order.id}`}
                className={twMerge(
                  stackingClassNames[index],
                  'rounded-4xl dark:bg-polar-900 dark:border-polar-700 peer absolute w-full border border-white transition-all duration-300 will-change-transform hover:z-10 hover:scale-100 peer-hover:opacity-0',
                )}
              >
                <OrderCard order={order} />
              </Link>
            ))}
        </div>
      ) : (
        <Card className="dark:text-polar-500 flex h-full flex-col items-center justify-center gap-y-6 p-6 text-gray-400">
          <ShoppingCartOutlined
            className="dark:text-polar-600 text-gray-200"
            fontSize="large"
          />
          <h3>No orders found</h3>
        </Card>
      )}
    </div>
  )
}
