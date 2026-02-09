import { formatCurrency } from '@polar-sh/currency'
import { DEFAULT_LOCALE, type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit.js'

interface MeteredPriceLabelProps {
  price: ProductPriceMeteredUnit
  locale?: AcceptedLocale
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale,
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency('subcent', locale)(
        Number.parseFloat(price.unitAmount),
        price.priceCurrency,
      )}
      <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
        {t('checkout.pricing.perUnit')}
      </span>
    </div>
  )
}

export default MeteredPriceLabel
