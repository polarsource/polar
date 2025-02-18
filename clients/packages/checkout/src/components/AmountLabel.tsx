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
      case 'month':
        return ' / mo'
      case 'year':
        return ' / yr'
      default:
        return ''
    }
  }, [interval])

  return (
    <div className="flex flex-row items-baseline">
      {formatCurrencyNumber(amount, currency, 0)}
      <span className="text-[0.5em]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
