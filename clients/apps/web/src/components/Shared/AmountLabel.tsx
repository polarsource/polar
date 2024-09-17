import { SubscriptionRecurringInterval } from '@polar-sh/sdk'
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
      case SubscriptionRecurringInterval.MONTH:
        return ' / mo'
      case SubscriptionRecurringInterval.YEAR:
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
