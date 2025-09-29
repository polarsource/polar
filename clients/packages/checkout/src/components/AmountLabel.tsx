import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import { useMemo } from 'react'

import { formatCurrencyNumber } from '../utils/money'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: SubscriptionRecurringInterval | null
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
}) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    switch (interval) {
      case 'day':
        return ' / dy'
      case 'week':
        return ' / wk'
      case 'month':
        return ' / mo'
      case 'year':
        return ' / yr'
      default:
        return ''
    }
  }, [interval])

  const minimumFractionDigits = useMemo(
    // Show 0 decimals if a round number, show default decimals (2 for USD) otherwise
    // This will trip when we add multi-currency (e.g. for JPY etc)
    () => (amount % 100 === 0 ? 0 : 2),
    [amount],
  )

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrencyNumber(amount, currency, minimumFractionDigits)}
      <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
