import type { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import { getMeteredTiers, type MeteredPrice } from '../utils/product'
import DetailRow from './DetailRow'
import MeteredRate from './MeteredRate'

interface MeteredTierRowsProps {
  price: MeteredPrice
  locale?: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

export const hasMeteredTierRows = (price: MeteredPrice): boolean =>
  getMeteredTiers(price).length > 1

const MeteredTierRows: React.FC<MeteredTierRowsProps> = ({
  price,
  locale = DEFAULT_LOCALE,
  discount,
}) => {
  const t = useTranslations(locale)

  if (price.amount_type !== 'metered_tiers' || !hasMeteredTierRows(price)) {
    return null
  }

  const tiers = getMeteredTiers(price)
  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
    locale,
  })
  const formatUnits = new Intl.NumberFormat(locale)

  return (
    <>
      {tiers.map((tier, index) => {
        // Bounds are inclusive, so a tier starts one unit past the one below it.
        const from = formatUnits.format((tiers[index - 1]?.bound ?? 0) + 1)
        const title =
          tier.bound == null
            ? t('checkout.pricing.tiers.andAbove', { from })
            : t('checkout.pricing.tiers.range', {
                from,
                to: formatUnits.format(tier.bound),
              })

        return (
          <DetailRow key={title} title={title} className="text-gray-600">
            <span className="flex flex-row items-baseline gap-x-1">
              <MeteredRate
                amount={Number.parseFloat(tier.unit_amount) * scale}
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
      {price.tiers.type === 'volume' && (
        <span className="dark:text-polar-500 text-xs text-gray-400">
          {t('checkout.pricing.tiers.volumeExplainer')}
        </span>
      )}
    </>
  )
}

export default MeteredTierRows
