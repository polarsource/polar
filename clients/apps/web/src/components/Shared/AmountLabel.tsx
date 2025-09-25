import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval']
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

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrencyAndAmount(amount, currency, minimumFractionDigits)}
      <span className="text-[max(12px,_0.5em)]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
