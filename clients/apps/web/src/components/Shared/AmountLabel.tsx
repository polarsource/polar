import { SubscriptionRecurringInterval } from '@polar-sh/api'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: SubscriptionRecurringInterval
  minimumFractionDigits?: number
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  minimumFractionDigits = 0,
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
      {formatCurrencyAndAmount(amount, currency, minimumFractionDigits)}
      <span className="text-[0.5em]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
