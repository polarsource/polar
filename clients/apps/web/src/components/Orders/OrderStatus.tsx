import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const OrderStatusColors = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded: 'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-500',
  partially_refunded:
    'bg-purple-100 text-purple-500 dark:bg-purple-950 dark:text-purple-500',
} as const

export const OrderStatus = ({
  status,
}: {
  status: schemas['Order']['status']
}) => {
  return (
    <Status
      status={status.split('_').join(' ')}
      className={twMerge(OrderStatusColors[status], 'capitalize')}
    />
  )
}
