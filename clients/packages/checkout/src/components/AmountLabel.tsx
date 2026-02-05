import { formatCurrency } from '@polar-sh/currency'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import { useMemo } from 'react'
import { formatRecurringInterval } from '../utils/product'

interface AmountLabelProps {
  amount: number
  currency: string
  mode: 'compact' | 'standard'
  interval?: SubscriptionRecurringInterval | null
  intervalCount?: number | null
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  intervalCount,
  mode,
}) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    const formatted = formatRecurringInterval(interval, intervalCount, 'short')
    return formatted ? ` / ${formatted}` : ''
  }, [interval, intervalCount])

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency(mode)(amount, currency)}
      {intervalDisplay ? (
        <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
      ) : null}
    </div>
  )
}

export default AmountLabel
