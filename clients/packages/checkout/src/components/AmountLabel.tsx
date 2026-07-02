import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { useTranslations } from '@polar-sh/i18n'
import { useMemo } from 'react'

interface AmountLabelProps {
  amount: number
  currency: string
  mode: 'compact' | 'standard'
  interval?: schemas['RecurringInterval'] | null
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
  const t = useTranslations(locale ?? 'en')
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    const formatted =
      intervalCount && intervalCount > 1
        ? t(`intervals.shortCount.${interval}`, { count: intervalCount })
        : t(`intervals.short.${interval}`)
    return formatted ? ` / ${formatted}` : ''
  }, [interval, intervalCount, t])

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
