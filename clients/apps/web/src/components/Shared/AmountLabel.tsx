import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['RecurringInterval']
  intervalCount?: number | null
  oneTime?: boolean
  verbose?: boolean
  unit?: string
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
  verbose,
  unit,
}: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return verbose && oneTime ? ' one-time' : ''
    }
    const prefix =
      intervalCount && intervalCount > 1
        ? ` every ${ordinal(intervalCount)}`
        : ''

    switch (interval) {
      case 'day':
        return ` /${prefix} ${verbose ? 'day' : 'dy'}`
      case 'week':
        return ` /${prefix} ${verbose ? 'week' : 'wk'}`
      case 'month':
        return ` /${prefix} ${verbose ? 'month' : 'mo'}`
      case 'year':
        return ` /${prefix} ${verbose ? 'year' : 'yr'}`
      default:
        return ``
    }
  }, [interval, intervalCount, oneTime, verbose])

  return (
    <span className="inline-flex flex-row items-baseline gap-x-1">
      {formatCurrency('compact')(amount, currency)}
      <span className="text-[max(12px,0.5em)]">
        {unit && ` / ${unit}`}
        {intervalDisplay}
      </span>
    </span>
  )
}

export default AmountLabel
