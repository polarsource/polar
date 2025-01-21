import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: SubscriptionRecurringInterval
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
      {formatCurrencyAndAmount(amount, currency, 0)}
      <span className="text-[0.5em]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
