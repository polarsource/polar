import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['RecurringInterval']
  intervalCount?: number | null
  fullInterval?: boolean
}

const fullIntervals: Record<schemas['RecurringInterval'], string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
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
  fullInterval = false,
}: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return fullInterval ? 'one-time' : ''
    }
    const prefix =
      intervalCount && intervalCount > 1
        ? ` every ${ordinal(intervalCount)}`
        : ''

    if (fullInterval) {
      const name = fullIntervals[interval]
      return name ? `/${prefix} ${name}` : ''
    }

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
  }, [fullInterval, interval, intervalCount])

  return (
    <span className="inline-flex flex-row items-baseline gap-x-1">
      {formatCurrency('compact')(amount, currency)}
      <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
    </span>
  )
}

export default AmountLabel
