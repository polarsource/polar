import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval']
  intervalCount?: number | null
  minimumFractionDigits?: number
}

const ordinalRules = new Intl.PluralRules('en', { type: 'ordinal' })

const suffixes = {
  zero: '',
  one: 'st',
  two: 'nd',
  few: 'rd',
  many: '',
  other: 'th',
}

const ordinal = (number: number): string => {
  const category = ordinalRules.select(number)
  const suffix = suffixes[category]
  return number + suffix
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  intervalCount,
  minimumFractionDigits = 0,
}) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    const prefix =
      intervalCount && intervalCount > 1
        ? ` every ${ordinal(intervalCount)}`
        : ''

    switch (interval) {
      case 'day':
        return ` /${prefix} dy`
      case 'week':
        return ` /${prefix} wk`
      case 'month':
        return ` /${prefix} mo`
      case 'year':
        return ` /${prefix} yr`
      default:
        return ``
    }
  }, [interval, intervalCount])

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrencyAndAmount(amount, currency, minimumFractionDigits)}
      <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
    </div>
  )
}

export default AmountLabel
