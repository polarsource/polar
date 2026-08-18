import type { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import { cn } from '@polar-sh/ui/lib/utils'
import MeteredRate from './MeteredRate'

interface MeteredPriceLabelProps {
  price: schemas['ProductPriceMeteredUnit']
  locale?: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

type MeteredTier = NonNullable<
  schemas['ProductPriceMeteredUnit']['tiers']
>['tiers'][number]

// The tier usage starts in: lowest bound first, unbounded tier last.
const getFirstTier = (
  price: schemas['ProductPriceMeteredUnit'],
): MeteredTier | null => {
  if (price.tiers == null) {
    return null
  }
  return (
    price.tiers.tiers.toSorted(
      (a, b) =>
        Number(a.up_to === null) - Number(b.up_to === null) ||
        (a.up_to ?? 0) - (b.up_to ?? 0),
    )[0] ?? null
  )
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
  discount,
}) => {
  const t = useTranslations(locale)
  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
  })

  const firstTier = getFirstTier(price)
  // Tier bounds are in base units, like the meter readings customers see in
  // their portal, while the rate is scaled to the meter's display unit.
  const upTo = firstTier?.up_to ?? null
  const rate = firstTier
    ? Number.parseFloat(firstTier.price_per_unit)
    : Number.parseFloat(price.unit_amount ?? '0')
  const baseAmount = rate * scale

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      <MeteredRate
        amount={baseAmount}
        currency={price.price_currency}
        locale={locale}
        discount={discount}
      />
      <span
        className={cn(
          'dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500',
          price.meter.unit === 'custom' ? 'lowercase' : '',
        )}
      >
        / {label}
      </span>
      {upTo !== null && (
        <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
          ·{' '}
          {t('checkout.pricing.upTo', {
            units: new Intl.NumberFormat(locale).format(upTo),
          })}
        </span>
      )}
    </div>
  )
}

export default MeteredPriceLabel
