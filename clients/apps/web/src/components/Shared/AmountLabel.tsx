import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval']
  intervalCount?: number | null
}

const UNIT_PLURAL: Record<schemas['SubscriptionRecurringInterval'], string> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  year: 'years',
}

const UNIT_SHORT: Record<schemas['SubscriptionRecurringInterval'], string> = {
  day: 'dy',
  week: 'wk',
  month: 'mo',
  year: 'yr',
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  intervalCount,
}: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    if (intervalCount && intervalCount > 1) {
      return ` / every ${intervalCount} ${UNIT_PLURAL[interval]}`
    }
    return ` / ${UNIT_SHORT[interval]}`
  }, [interval, intervalCount])

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency('compact')(amount, currency)}
      <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
