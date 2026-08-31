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
  showTierLadder?: boolean
}

type MeteredTier = NonNullable<
  schemas['ProductPriceMeteredUnit']['tiers']
>['tiers'][number]

const mutedTextClass =
  'dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500'

const getSortedTiers = (
  price: schemas['ProductPriceMeteredUnit'],
): MeteredTier[] => {
  if (price.tiers == null) {
    return []
  }

  return [...price.tiers.tiers].sort(
    (a, b) =>
      Number(a.bound === null) - Number(b.bound === null) ||
      (a.bound ?? 0) - (b.bound ?? 0),
  )
}

interface MeteredRateProps {
  unitAmount: string
  scale: number
  label: string
  currency: string
  locale: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
  lowercaseLabel: boolean
}

const MeteredRate = ({
  unitAmount,
  scale,
  label,
  currency,
  locale,
  discount,
  lowercaseLabel,
}: MeteredRateProps) => {
  const format = formatCurrency('subcent', locale)
  const baseAmount = Number.parseFloat(unitAmount) * scale
  const discountedAmount =
    discount && 'basis_points' in discount
      ? baseAmount * (1 - discount.basis_points / 10000)
      : null

  return (
    <span className="flex flex-row items-baseline gap-x-1">
      {discountedAmount !== null ? (
        <>
          <span className="dark:text-polar-500 text-gray-400 line-through">
            {format(baseAmount, currency)}
          </span>
          <span>{format(discountedAmount, currency)}</span>
        </>
      ) : (
        format(baseAmount, currency)
      )}
      <span className={cn(mutedTextClass, lowercaseLabel ? 'lowercase' : '')}>
        / {label}
      </span>
    </span>
  )
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
  discount,
  showTierLadder = false,
}) => {
  const t = useTranslations(locale)
  const tiers = getSortedTiers(price)
  const firstTier = tiers[0] ?? null
  const unitAmount = firstTier?.unit_amount ?? price.unit_amount
  if (unitAmount === null) return null

  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
  })

  const lowercaseLabel = price.meter.unit === 'custom'
  const numberFormat = new Intl.NumberFormat(locale)

  if (showTierLadder && price.tiers !== null) {
    return (
      <span className="flex w-full flex-col gap-y-1.5">
        {tiers.map((tier, index) => {
          const previousBound = index > 0 ? tiers[index - 1].bound : null
          const range =
            index === 0
              ? tier.bound == null
                ? t('checkout.pricing.tieredPricing.allUsage')
                : t('checkout.pricing.tieredPricing.upTo', {
                    units: numberFormat.format(tier.bound),
                  })
              : tier.bound == null
                ? t('checkout.pricing.tieredPricing.over', {
                    units: numberFormat.format(previousBound ?? 0),
                  })
                : t('checkout.pricing.tieredPricing.overUpTo', {
                    lowerBound: numberFormat.format(previousBound ?? 0),
                    upperBound: numberFormat.format(tier.bound),
                  })

          return (
            <span
              key={tier.bound ?? 'unbounded'}
              className="flex flex-row items-baseline justify-between gap-x-6"
            >
              <span className={mutedTextClass}>{range}</span>
              <MeteredRate
                unitAmount={tier.unit_amount}
                scale={scale}
                label={label}
                currency={price.price_currency}
                locale={locale}
                discount={discount}
                lowercaseLabel={lowercaseLabel}
              />
            </span>
          )
        })}
      </span>
    )
  }

  const bound = firstTier?.bound ?? null

  return (
    <span className="flex flex-row items-baseline gap-x-1">
      <MeteredRate
        unitAmount={unitAmount}
        scale={scale}
        label={label}
        currency={price.price_currency}
        locale={locale}
        discount={discount}
        lowercaseLabel={lowercaseLabel}
      />
      {bound !== null && (
        <span className={mutedTextClass}>
          ·{' '}
          {t('checkout.pricing.upTo', {
            units: numberFormat.format(bound),
          })}
        </span>
      )}
    </span>
  )
}

export default MeteredPriceLabel
