import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { getTranslations } from '@polar-sh/i18n'
import { formatOrdinal } from '@polar-sh/i18n/formatters/ordinal'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  mode: 'compact' | 'standard'
  interval?: SubscriptionRecurringInterval | null
  intervalCount?: number | null
  locale?: AcceptedLocale
}

const AmountLabel: React.FC<AmountLabelProps> = ({
  amount,
  currency,
  interval,
  intervalCount,
  mode,
  locale,
}) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    const t = getTranslations(locale ?? 'en')
    const count = intervalCount && intervalCount > 1 ? intervalCount : null
    const prefix = count ? `${formatOrdinal(count, locale ?? 'en')} ` : ''
    const formatted = `${prefix}${t.intervals.short[interval]}`
    return formatted ? ` / ${formatted}` : ''
  }, [interval, intervalCount, locale])

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency(mode, locale)(amount, currency)}
      {intervalDisplay ? (
        <span className="text-[max(12px,0.5em)]">{intervalDisplay}</span>
      ) : null}
    </div>
  )
}

export default AmountLabel
