import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const OrderStatusColors = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
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
