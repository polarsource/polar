import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import { cn } from '@polar-sh/ui/lib/utils'

interface MeteredPriceLabelProps {
  price: schemas['ProductPriceMeteredUnit']
  locale?: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

type MeteredTier = NonNullable<
  schemas['ProductPriceMeteredUnit']['tiers']
>['tiers'][number]

const mutedTextClass =
  'dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500'

const getFirstTier = (
  price: schemas['ProductPriceMeteredUnit'],
): MeteredTier | null => {
  if (price.tiers == null) {
    return null
  }
  return (
    price.tiers.tiers.toSorted(
      (a, b) =>
        Number(a.bound === null) - Number(b.bound === null) ||
        (a.bound ?? 0) - (b.bound ?? 0),
    )[0] ?? null
  )
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
  discount,
}) => {
  const t = useTranslations(locale)

  if (price.unit_amount == null) return null

  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
  })

  const format = formatCurrency('subcent', locale)
  const firstTier = getFirstTier(price)
  const bound = firstTier?.bound ?? null
  const rate = Number.parseFloat(
    firstTier?.unit_amount ?? price.unit_amount ?? '0',
  )
  const baseAmount = rate * scale
  const discountedAmount =
    discount && 'basis_points' in discount
      ? baseAmount * (1 - discount.basis_points / 10000)
      : null

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {discountedAmount !== null ? (
        <>
          <span className="dark:text-polar-500 text-gray-400 line-through">
            {format(baseAmount, price.price_currency)}
          </span>
          <span>{format(discountedAmount, price.price_currency)}</span>
        </>
      ) : (
        format(baseAmount, price.price_currency)
      )}
      <span
        className={cn(
          mutedTextClass,
          price.meter.unit === 'custom' ? 'lowercase' : '',
        )}
      >
        / {label}
      </span>
      {bound !== null && (
        <span className={mutedTextClass}>
          ·{' '}
          {t('checkout.pricing.upTo', {
            units: new Intl.NumberFormat(locale).format(bound),
          })}
        </span>
      )}
    </div>
  )
}

export default MeteredPriceLabel
