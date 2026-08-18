import type { schemas } from '@polar-sh/client'
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import DetailRow from './DetailRow'
import MeteredRate from './MeteredRate'

interface MeteredTierRowsProps {
  price: schemas['ProductPriceMeteredUnit']
  locale: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

// One tier is just a flat rate, so there is no table worth showing.
export const hasMeteredTierRows = (
  price: schemas['ProductPriceMeteredUnit'],
): boolean => (price.tiers?.tiers.length ?? 0) > 1

// The rate card for a tiered metered price. There is no usage yet at checkout,
// so unlike seats there is nothing to total up — this is what the buyer is
// agreeing to, one row per tier.
const MeteredTierRows = ({ price, locale, discount }: MeteredTierRowsProps) => {
  const t = useTranslations(locale)

  if (price.tiers == null || !hasMeteredTierRows(price)) {
    return null
  }

  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
  })
  const formatUnits = new Intl.NumberFormat(locale)

  const sorted = price.tiers.tiers.toSorted(
    (a, b) =>
      Number(a.up_to === null) - Number(b.up_to === null) ||
      (a.up_to ?? 0) - (b.up_to ?? 0),
  )

  // Bounds are inclusive, so a tier starts one unit past the one below it.
  const rows = sorted.map((tier, index) => ({
    tier,
    from: (sorted[index - 1]?.up_to ?? 0) + 1,
  }))

  return (
    <>
      {rows.map(({ tier, from }, index) => {
        const title =
          tier.up_to === null
            ? t('checkout.pricing.tiers.andAbove', {
                from: formatUnits.format(from),
              })
            : t('checkout.pricing.tiers.range', {
                from: formatUnits.format(from),
                to: formatUnits.format(tier.up_to),
              })

        return (
          <DetailRow key={index} title={title} className="text-gray-600">
            <span className="flex flex-row items-baseline gap-x-1">
              <MeteredRate
                amount={Number.parseFloat(tier.price_per_unit) * scale}
                currency={price.price_currency}
                locale={locale}
                discount={discount}
              />
              <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
                / {label}
              </span>
            </span>
          </DetailRow>
        )
      })}
      {/* A tier table reads as graduated by default, so only volume — which
          reprices everything once a bound is crossed — needs saying. */}
      {price.tiers.tier_type === 'volume' && (
        <DetailRow
          title={t('checkout.pricing.tiers.volumeExplainer')}
          className="dark:text-polar-500 text-xs text-gray-400"
        />
      )}
    </>
  )
}

export default MeteredTierRows
