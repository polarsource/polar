import {
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useState } from 'react'

type Status = 'pending' | 'available' | 'paid_out'

const IncomeStatusDisplayTitle: Record<Status, string> = {
  pending: 'Pending',
  available: 'Available',
  paid_out: 'Paid out',
}

const IncomeStatusIcon: Record<Status, StatusIconProps> = {
  pending: { shape: 'half', tone: 'yellow' },
  available: { shape: 'most', tone: 'blue' },
  paid_out: { shape: 'check', tone: 'green' },
}

// Income is held for the account's payout delay before it can be paid out.
const getAvailableAt = (
  transaction: schemas['Transaction'],
  delay: ISODuration | null,
) =>
  delay?.isNonZero() ? delay.addToDate(new Date(transaction.created_at)) : null

const getIncomeStatus = (
  transaction: schemas['Transaction'],
  availableAt: Date | null,
  now: number,
): Status => {
  if (transaction.payout_transaction_id) return 'paid_out'
  return availableAt && availableAt.getTime() > now ? 'pending' : 'available'
}

const getDescription = (status: Status, availableAt: Date | null) => {
  if (status === 'paid_out') return 'Included in a payout.'
  if (status === 'available') return 'Ready to be paid out.'
  return availableAt
    ? `Held until ${format(availableAt, 'MMM d, HH:mm')}, then ready to be paid out.`
    : undefined
}

const useIncomeStatus = (
  transaction: schemas['Transaction'],
  delay: ISODuration | null,
) => {
  const [now] = useState(() => Date.now())
  const availableAt = getAvailableAt(transaction, delay)
  return {
    status: getIncomeStatus(transaction, availableAt, now),
    availableAt,
  }
}

export const IncomeStatus = ({
  transaction,
  delay,
}: {
  transaction: schemas['Transaction']
  delay: ISODuration | null
}) => {
  const { status, availableAt } = useIncomeStatus(transaction, delay)
  return (
    <StatusLabel
      {...IncomeStatusIcon[status]}
      label={IncomeStatusDisplayTitle[status]}
      description={getDescription(status, availableAt)}
    />
  )
}
