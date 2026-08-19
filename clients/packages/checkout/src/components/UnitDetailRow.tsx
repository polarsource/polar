import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import { getUnitLabels, type UnitRow } from '../utils/units'
import AmountLabel from './AmountLabel'
import DetailRow from './DetailRow'

interface UnitDetailRowProps {
  row: UnitRow
  currency: string
  interval?: schemas['RecurringInterval'] | null
  intervalCount?: number | null
  locale: AcceptedLocale
  unitPrice?: schemas['ProductPriceUnitBased'] | null
}

const UnitDetailRow = ({
  row,
  currency,
  interval,
  intervalCount,
  locale,
  unitPrice,
}: UnitDetailRowProps) => {
  const t = useTranslations(locale)
  const { unitLabel, unitLabelPlural } = getUnitLabels(unitPrice, locale)

  return (
    <DetailRow
      title={t('checkout.pricing.units.count', {
        count: row.units,
        unitLabel,
        unitLabelPlural,
      })}
      subtitle={
        '· ' +
        formatCurrency('standard', locale)(row.pricePerUnit, currency) +
        ' ' +
        t('checkout.pricing.perUnit', { unitLabel })
      }
      className="text-gray-600"
    >
      <AmountLabel
        amount={row.units * row.pricePerUnit}
        currency={currency}
        interval={interval}
        intervalCount={intervalCount}
        mode="standard"
        locale={locale}
      />
    </DetailRow>
  )
}

export default UnitDetailRow
