import { formatCurrency } from '@polar-sh/currency'
import { type SupportedLocale, useTranslations } from '@polar-sh/i18n'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit.js'

interface MeteredPriceLabelProps {
  price: ProductPriceMeteredUnit
  locale?: SupportedLocale
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale,
}) => {
  const t = useTranslations(locale ?? 'en')

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatCurrency('subcent')(
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
