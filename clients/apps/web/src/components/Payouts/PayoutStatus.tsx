import { schemas } from '@spaire/client'
import { Status } from '@spaire/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const PayoutStatusColors = {
  succeeded:
    'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  in_transit:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  pending: 'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-500',
} as const

export const PayoutStatus = ({
  status,
}: {
  status: schemas['Payout']['status']
}) => {
  return (
    <Status
      status={status.split('_').join(' ')}
      className={twMerge(PayoutStatusColors[status], 'capitalize')}
    />
  )
}
