import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { ISODuration } from '@/utils/duration'
import { twMerge } from 'tailwind-merge'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

const TransactionAvailabilityStatusColor: Record<
  'on_hold' | 'available' | 'paid_out',
  string
> = {
  on_hold: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  available: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  paid_out: 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
}

const TransactionAvailabilityStatusTitle: Record<
  'on_hold' | 'available' | 'paid_out',
  string
> = {
  on_hold: 'On hold',
  available: 'Available',
  paid_out: 'Paid out',
}

const getTransactionAvailability = (
  transaction: schemas['Transaction'] | schemas['TransactionEmbedded'],
  delay: ISODuration | null,
): {
  status: 'on_hold' | 'available' | 'paid_out'
  availableAt?: Date
} => {
  // Check if this transaction has been paid out
  if (
    'payout_transaction_id' in transaction &&
    transaction.payout_transaction_id
  ) {
    return { status: 'paid_out' }
  }

  // Payout transactions are always available
  if ('type' in transaction && transaction.type === 'payout') {
    return { status: 'available' }
  }

  // If no delay is configured, all transactions are available
  if (!delay || !delay.isNonZero()) {
    return { status: 'available' }
  }

  const createdAt = new Date(transaction.created_at)
  const availableAt = delay.addToDate(createdAt)
  const now = new Date()

  if (availableAt <= now) {
    return { status: 'available' }
  }

  return { status: 'on_hold', availableAt }
}

export const TransactionAvailabilityStatus = ({
  transaction,
  delay,
}: {
  transaction: schemas['Transaction'] | schemas['TransactionEmbedded']
  delay: ISODuration | null
}) => {
  const { status, availableAt } = getTransactionAvailability(transaction, delay)

  if (status === 'on_hold' && availableAt) {
    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <Status
            status={TransactionAvailabilityStatusTitle[status]}
            className={twMerge(
              'w-fit',
              TransactionAvailabilityStatusColor[status],
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Available on{' '}
            <FormattedDateTime datetime={availableAt} dateStyle="medium" />
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Status
      status={TransactionAvailabilityStatusTitle[status]}
      className={twMerge('w-fit', TransactionAvailabilityStatusColor[status])}
    />
  )
}
