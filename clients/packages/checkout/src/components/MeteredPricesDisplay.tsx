'use client'

import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { useMemo } from 'react'
import { ProductCheckoutPublic } from '../guards'
import { getMeteredPrices } from '../utils/product'
import ProductPriceLabel from './ProductPriceLabel'
import GaugeIcon from './icons/GaugeIcon'

interface MeteredPricesDisplayProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
}

const MeteredPricesDisplay = ({
  checkout,
  locale = DEFAULT_LOCALE,
}: MeteredPricesDisplayProps) => {
  const t = useTranslations(locale)
  const { product, prices, product_price, currency } = checkout

  // Get the metered prices, minus the currently selected one, in case there are only metered prices
  const meteredPrices = useMemo(
    () =>
      getMeteredPrices(prices[product.id], currency).filter(
        (p) => p.id !== product_price.id,
      ),
    [prices, product, product_price, currency],
  )

  if (meteredPrices.length === 0) {
    return null
  }

  return (
    <div className="text-sm">
      <h2 className="mb-2 text-base font-medium">
        + {t('checkout.pricing.additionalMeteredUsage')}
      </h2>
      {meteredPrices.map((price) => (
        <div
          key={price.id}
          className="dark:text-polar-100 flex flex-row items-center gap-x-2 text-sm text-gray-600"
        >
          <GaugeIcon className="h-4 w-4" />
          <ProductPriceLabel product={product} price={price} locale={locale} />
        </div>
      ))}
    </div>
  )
}

export default MeteredPricesDisplay
