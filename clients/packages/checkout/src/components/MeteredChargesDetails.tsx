'use client'

import { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
  type TranslateFn,
} from '@polar-sh/i18n'
import { cn } from '@polar-sh/ui/lib/utils'
import { Fragment, useId, useState } from 'react'
import { getSeatPrice, hasProductCheckout } from '../guards'
import { getMeteredPrices } from '../utils/product'
import DetailRow from './DetailRow'
import MeteredPriceLabel from './MeteredPriceLabel'
import MeteredTierRows, { hasMeteredTierRows } from './MeteredTierRows'
import ChevronDownIcon from './icons/ChevronDownIcon'

interface IncludedUnits {
  perSeat: number
  team: number
}

const getIncludedUnitsByMeter = (
  benefits: schemas['CheckoutProduct']['benefits'],
  isSeatBased: boolean,
): Map<string, IncludedUnits> => {
  const included = new Map<string, IncludedUnits>()
  for (const benefit of benefits) {
    if (benefit.type === 'meter_credit') {
      const { meter_id, units, allocation } = benefit.properties
      const current = included.get(meter_id) ?? { perSeat: 0, team: 0 }
      if (isSeatBased && allocation === 'per_claimed_seat') {
        current.perSeat += units
      } else {
        current.team += units
      }
      included.set(meter_id, current)
    }
  }
  return included
}

const getIncludedLabel = (
  included: IncludedUnits | undefined,
  isSeatBased: boolean,
  formatUnits: (units: number) => string,
  t: TranslateFn,
): string | undefined => {
  if (!included) {
    return undefined
  }
  const { perSeat, team } = included
  if (!isSeatBased) {
    return team
      ? t('checkout.pricing.meteredIncluded', { units: formatUnits(team) })
      : undefined
  }
  if (perSeat && team) {
    return t('checkout.pricing.meteredIncludedPerSeatAndTeam', {
      perSeatUnits: formatUnits(perSeat),
      teamUnits: formatUnits(team),
    })
  }
  if (perSeat) {
    return t('checkout.pricing.meteredIncludedPerSeat', {
      units: formatUnits(perSeat),
    })
  }
  if (team) {
    return t('checkout.pricing.meteredIncludedTeam', {
      units: formatUnits(team),
    })
  }
  return undefined
}

const getUnitNoun = (
  meter: schemas['ProductPriceMeteredUnit']['meter'],
  t: TranslateFn,
): string => {
  if (meter.unit === 'custom' && meter.custom_label) {
    return meter.custom_label
  }
  return meter.unit === 'token'
    ? t('checkout.pricing.meterUnits.token')
    : t('checkout.pricing.meterUnits.scalar')
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

  const isSeatBased = getSeatPrice(checkout) !== null
  const includedUnitsByMeter = getIncludedUnitsByMeter(
    product.benefits,
    isSeatBased,
  )
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
            const formatUnits = (units: number) =>
              `${numberFormat.format(units)} ${getUnitNoun(meteredPrice.meter, t)}`
            return (
              <Fragment key={meteredPrice.id}>
                <DetailRow
                  title={meteredPrice.meter.name}
                  subtitle={getIncludedLabel(
                    includedUnitsByMeter.get(meteredPrice.meter.id),
                    isSeatBased,
                    formatUnits,
                    t,
                  )}
                  emphasis
                >
                  {!hasMeteredTierRows(meteredPrice) && (
                    <MeteredPriceLabel
                      price={meteredPrice}
                      locale={locale}
                      discount={checkout.discount}
                    />
                  )}
                </DetailRow>
                <MeteredTierRows
                  price={meteredPrice}
                  locale={locale}
                  discount={checkout.discount}
                />
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MeteredChargesDetails
