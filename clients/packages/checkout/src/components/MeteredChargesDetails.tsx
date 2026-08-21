'use client'

import { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { cn } from '@polar-sh/ui/lib/utils'
import { useId, useState } from 'react'
import { hasProductCheckout } from '../guards'
import { getMeteredPrices } from '../utils/product'
import DetailRow from './DetailRow'
import MeteredPriceLabel from './MeteredPriceLabel'
import ChevronDownIcon from './icons/ChevronDownIcon'

const getIncludedUnitsByMeter = (
  benefits: schemas['CheckoutProduct']['benefits'],
): Map<string, number> => {
  const included = new Map<string, number>()
  for (const benefit of benefits) {
    if (benefit.type === 'meter_credit') {
      const { meter_id, units } = benefit.properties
      included.set(meter_id, (included.get(meter_id) ?? 0) + units)
    }
  }
  return included
}

const getUnitNoun = (
  meter: schemas['ProductPriceMeteredUnit']['meter'],
): string => {
  if (meter.unit === 'custom') {
    return meter.custom_label ?? 'units'
  }
  return meter.unit === 'token' ? 'tokens' : 'units'
}

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
  const rowsId = useId()

  if (!hasProductCheckout(checkout)) {
    return null
  }

  const { product, prices, currency } = checkout
  const meteredPrices = getMeteredPrices(prices[product.id] ?? [], currency)
  if (meteredPrices.length === 0) {
    return null
  }

  const includedUnitsByMeter = getIncludedUnitsByMeter(product.benefits)
  const numberFormat = new Intl.NumberFormat(locale)

  return (
    <div className="dark:border-polar-700 mt-2 flex flex-col gap-y-2 border-t border-gray-200 pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={rowsId}
        onClick={() => setExpanded((value) => !value)}
        className="dark:text-polar-500 flex cursor-pointer flex-row items-center justify-between gap-x-8 text-gray-500"
      >
        <span>{t('checkout.pricing.meteredChargesMayApply')}</span>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div id={rowsId} className="flex flex-col gap-y-2">
          {meteredPrices.map((meteredPrice) => {
            const includedUnits = includedUnitsByMeter.get(
              meteredPrice.meter.id,
            )
            return (
              <DetailRow
                key={meteredPrice.id}
                title={meteredPrice.meter.name}
                subtitle={
                  includedUnits
                    ? t('checkout.pricing.meteredIncluded', {
                        units: `${numberFormat.format(includedUnits)} ${getUnitNoun(meteredPrice.meter)}`,
                      })
                    : undefined
                }
                emphasis
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
      )}
    </div>
  )
}

export default MeteredChargesDetails
