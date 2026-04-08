import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { DEFAULT_LOCALE, type AcceptedLocale } from '@polar-sh/i18n'
import { getMeterUnitFormat } from '../utils/meterUnit'

interface MeteredPriceLabelProps {
  price: schemas['ProductPriceMeteredUnit']
  locale?: AcceptedLocale
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
}) => {
  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar')

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency('subcent', locale)(
        Number.parseFloat(price.unit_amount) * scale,
        price.price_currency,
      )}
      <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
        / {label}
      </span>
    </div>
  )
}

export default MeteredPriceLabel
