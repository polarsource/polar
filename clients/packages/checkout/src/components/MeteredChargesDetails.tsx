'use client'

import { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { cn } from '@polar-sh/ui/lib/utils'
import { useMemo, useState } from 'react'
import { getMeteredPrices } from '../utils/product'
import DetailRow from './DetailRow'
import MeteredPriceLabel from './MeteredPriceLabel'
import ChevronDownIcon from './icons/ChevronDownIcon'

interface MeteredChargesDetailsProps {
  checkout: schemas['CheckoutPublic']
  locale?: AcceptedLocale
}

const MeteredChargesDetails = ({
  checkout,
  locale = DEFAULT_LOCALE,
}: MeteredChargesDetailsProps) => {
  const t = useTranslations(locale)
  const [expanded, setExpanded] = useState(false)

  const { product, prices, currency } = checkout
  const meteredPrices = useMemo(
    () =>
      product && prices ? getMeteredPrices(prices[product.id], currency) : [],
    [product, prices, currency],
  )

  const includedUnitsByMeter = useMemo(() => {
    const included = new Map<string, number>()
    for (const benefit of product?.benefits ?? []) {
      if (benefit.type === 'meter_credit' && 'properties' in benefit) {
        const { meter_id, units } = benefit.properties
        included.set(meter_id, (included.get(meter_id) ?? 0) + units)
      }
    }
    return included
  }, [product])

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale])

  if (meteredPrices.length === 0) {
    return null
  }

  return (
    <div className="dark:border-polar-700 mt-2 flex flex-col gap-y-2 border-t border-gray-200 pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="dark:text-polar-500 flex cursor-pointer flex-row items-center justify-between gap-x-8 text-gray-500"
      >
        <span>{t('checkout.pricing.meteredChargesMayApply')}</span>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded &&
        meteredPrices.map((meteredPrice) => {
          const includedUnits = includedUnitsByMeter.get(meteredPrice.meter.id)
          return (
            <DetailRow
              key={meteredPrice.id}
              title={meteredPrice.meter.name}
              subtitle={
                includedUnits
                  ? t('checkout.pricing.meteredIncludedThen', {
                      units: numberFormat.format(includedUnits),
                    })
                  : undefined
              }
              className="text-gray-600"
            >
              <MeteredPriceLabel
                price={meteredPrice}
                locale={locale}
                discount={checkout.discount}
              />
            </DetailRow>
          )
        })}
    </div>
  )
}

export default MeteredChargesDetails
