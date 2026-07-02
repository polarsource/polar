import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import type { SeatRow } from '../utils/seats'
import AmountLabel from './AmountLabel'
import DetailRow from './DetailRow'

interface SeatDetailRowProps {
  row: SeatRow
  currency: string
  interval?: schemas['RecurringInterval'] | null
  intervalCount?: number | null
  locale: AcceptedLocale
}

const SeatDetailRow = ({
  row,
  currency,
  interval,
  intervalCount,
  locale,
}: SeatDetailRowProps) => {
  const t = useTranslations(locale)

  if (row.min === 1 && row.pricePerSeat === 0 && row.max !== null) {
    return (
      <DetailRow
        title={t('checkout.pricing.seats.included', { count: row.max })}
        className="text-gray-600"
      />
    )
  }

  return (
    <DetailRow
      title={t('checkout.pricing.seats.count', { count: row.seats })}
      subtitle={
        '· ' +
        formatCurrency('standard', locale)(row.pricePerSeat, currency) +
        ' ' +
        t('checkout.pricing.perSeat')
      }
      className="text-gray-600"
    >
      <AmountLabel
        amount={row.seats * row.pricePerSeat}
        currency={currency}
        interval={interval}
        intervalCount={intervalCount}
        mode="standard"
        locale={locale}
      />
    </DetailRow>
  )
}

export default SeatDetailRow
