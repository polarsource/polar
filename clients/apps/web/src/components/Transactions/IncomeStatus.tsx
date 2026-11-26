import {
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
import { ISODuration } from '@/utils/duration'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'

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

// Income that becomes available within a day does so while the page is open.
const MAX_WAIT = 24 * 60 * 60 * 1000

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
  const [now, setNow] = useState(() => Date.now())
  const availableAt = getAvailableAt(transaction, delay)
  const remaining = availableAt ? availableAt.getTime() - now : 0
  useEffect(() => {
    if (remaining <= 0 || remaining > MAX_WAIT) return
    const timeout = setTimeout(() => setNow(Date.now()), remaining)
    return () => clearTimeout(timeout)
  }, [remaining])
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
