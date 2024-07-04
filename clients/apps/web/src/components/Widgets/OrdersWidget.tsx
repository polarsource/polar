import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useOrders } from '@/hooks/queries/orders'
import { ShoppingCartOutlined } from '@mui/icons-material'
import { Order } from '@polar-sh/sdk'
import { getCentsInDollarString } from '@polarkit/lib/money'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { twMerge } from 'tailwind-merge'

interface OrderCardProps {
  className?: string
  order: Order
}

const OrderCard = ({ className, order }: OrderCardProps) => {
  const createdAtDate = new Date(order.created_at)

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
      <CardHeader className="dark:text-polar-500 flex flex-row items-baseline justify-between pb-6 text-sm text-gray-400">
        <span>{displayDate}</span>
        <span>{displayTime}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-1 pb-6 text-lg">
        <h3>{order.product.name}</h3>
        <span className="dark:text-polar-500 text-gray-400">
          ${getCentsInDollarString(order.amount, false)}
        </span>
      </CardContent>
      <CardFooter className="flex flex-row items-center gap-x-4">
        <Avatar
          className="h-10 w-10"
          name={order.user.public_name}
          avatar_url={order.user.avatar_url}
        />
        <div className="flex flex-col text-sm">
          <span>{order.user.public_name}</span>
          <span className="dark:text-polar-500 text-gray-400">
            {order.user.email}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export interface OrdersWidgetProps {
  className?: string
}

export const OrdersWidget = ({ className }: OrdersWidgetProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const orders = useOrders(org?.id, { limit: 3, sorting: ['-created_at'] })

  const stackingClassNames = [
    'scale-90',
    'top-1/2 -translate-y-1/2 scale-[.95]',
    'bottom-0',
  ]

  const classNames = [
    'dark:bg-polar-900',
    'dark:bg-polar-800',
    'dark:bg-polar-700',
  ]

  return (
    <Link
      className={twMerge('h-80', className)}
      href={`/maintainer/${org?.name}/sales/orders`}
    >
      {(orders.data?.items?.length ?? 0) > 0 ? (
        <div className="relative h-full">
          {orders.data?.items?.reverse().map((order, index) => (
            <div
              key={order.id}
              className={twMerge(
                stackingClassNames[index],
                'rounded-4xl dark:bg-polar-900 peer absolute w-full border border-gray-100 bg-white transition-all duration-300 hover:z-10 hover:scale-100 hover:shadow-2xl peer-hover:opacity-0 dark:border-transparent',
              )}
            >
              <OrderCard className={twMerge(classNames[index])} order={order} />
            </div>
          ))}
        </div>
      ) : (
        <Card className="dark:text-polar-500 flex h-full flex-col items-center justify-center gap-y-6 p-6 text-gray-400 ring-1 ring-gray-100 dark:ring-transparent">
          <ShoppingCartOutlined
            className="dark:text-polar-600 text-gray-200"
            fontSize="large"
          />
          <h3>No orders found</h3>
        </Card>
      )}
    </Link>
  )
}
