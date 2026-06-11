import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { ISODuration } from '@/utils/duration'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useState } from 'react'

const TransactionAvailabilityStatusColor: Record<
  'on_hold' | 'available' | 'paid_out',
  StatusColor
> = {
  on_hold: 'blue',
  available: 'green',
  paid_out: 'gray',
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
  const [mountedAt] = useState(() => Date.now())

  if (status === 'on_hold' && availableAt) {
    const isWithin48Hours =
      availableAt.getTime() - mountedAt <= 48 * 60 * 60 * 1000

    return (
      <Tooltip>
        <TooltipTrigger>
          <Status
            status={TransactionAvailabilityStatusTitle[status]}
            color={TransactionAvailabilityStatusColor[status]}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Available on{' '}
            <FormattedDateTime
              datetime={availableAt}
              dateStyle="medium"
              resolution={isWithin48Hours ? 'time' : 'day'}
            />
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Status
      status={TransactionAvailabilityStatusTitle[status]}
      color={TransactionAvailabilityStatusColor[status]}
    />
  )
}
