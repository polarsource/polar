import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['RecurringInterval']
  intervalCount?: number | null
  oneTime?: boolean
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
  oneTime,
}: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return oneTime ? ' one-time' : ''
    }
    const prefix =
      intervalCount && intervalCount > 1
        ? ` every ${ordinal(intervalCount)}`
        : ''

    switch (interval) {
      case 'day':
        return ` /${prefix} day`
      case 'week':
        return ` /${prefix} week`
      case 'month':
        return ` /${prefix} month`
      case 'year':
        return ` /${prefix} year`
      default:
        return ``
    }
  }, [interval, intervalCount, oneTime])

  return (
    <span className="inline-flex flex-row items-baseline gap-x-1">
      {formatCurrency('compact')(amount, currency)}
      <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
    </span>
  )
}

export default AmountLabel
