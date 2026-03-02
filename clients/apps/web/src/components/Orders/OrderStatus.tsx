import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const OrderStatusDisplayTitle: Record<schemas['Order']['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  void: 'Void',
}

const OrderStatusDisplayColor: Record<schemas['Order']['status'], string> = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
}

export const OrderStatus = ({
  status,
  size,
}: {
  status: schemas['Order']['status']
  size?: 'small' | 'medium'
}) => {
  return (
    <Status
      className={twMerge(OrderStatusDisplayColor[status], 'w-fit')}
      status={OrderStatusDisplayTitle[status]}
      size={size}
    />
  )
}
