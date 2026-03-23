import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'

interface MeteredPriceLabelProps {
  price: schemas['ProductPriceMeteredUnit']
  locale?: AcceptedLocale
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
}) => {
  const t = useTranslations(locale)

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency('subcent', locale)(
        Number.parseFloat(price.unit_amount),
        price.price_currency,
      )}
      <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
        {t('checkout.pricing.perUnit')}
      </span>
    </div>
  )
}

export default MeteredPriceLabel
