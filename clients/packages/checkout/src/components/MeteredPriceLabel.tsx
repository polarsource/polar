import { getTranslations, type SupportedLocale } from '@polar-sh/i18n'
import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit.js'
import { useMemo } from 'react'
import { formatUnitAmount } from '../utils/money'

interface MeteredPriceLabelProps {
  price: ProductPriceMeteredUnit
  locale?: SupportedLocale
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = 'en',
}) => {
  const t = useMemo(() => getTranslations(locale), [locale])

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatUnitAmount(
        Number.parseFloat(price.unitAmount),
        price.priceCurrency,
      )}
      <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
        {t.pricing.perUnit}
      </span>
    </div>
  )
}

export default MeteredPriceLabel
