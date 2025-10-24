import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import { useMemo } from 'react'

import { formatCurrencyNumber } from '../utils/money'
import { formatRecurringInterval } from '../utils/product'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: SubscriptionRecurringInterval | null
  intervalCount?: number | null
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  intervalCount,
}) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    const formatted = formatRecurringInterval(interval, intervalCount, 'short')
    return formatted ? ` / ${formatted}` : ''
  }, [interval, intervalCount])

  const minimumFractionDigits = useMemo(
    // Show 0 decimals if a round number, show default decimals (2 for USD) otherwise
    // This will trip when we add multi-currency (e.g. for JPY etc)
    () => (amount % 100 === 0 ? 0 : 2),
    [amount],
  )

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrencyNumber(amount, currency, minimumFractionDigits)}
      {intervalDisplay ? (
        <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
      ) : null}
    </div>
  )
}

export default AmountLabel
