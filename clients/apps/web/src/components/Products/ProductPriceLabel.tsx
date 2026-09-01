import {
  getUnitLabels,
  isLegacyRecurringPrice,
  isMeteredPrice,
  MeteredPrice,
  isSeatBasedPrice,
  isUnitBasedPrice,
} from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product: schemas['Product'] | schemas['CheckoutProduct']
  currency: string
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  currency,
}: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(
    ({ amount_type, price_currency }) =>
      price_currency === currency &&
      ['fixed', 'custom', 'seat_based', 'unit_based'].includes(amount_type),
  )

  if (staticPrice?.amount_type === 'fixed' && staticPrice.price_amount !== 0) {
    return (
      <AmountLabel
        amount={staticPrice.price_amount}
        currency={staticPrice.price_currency}
        interval={
          isLegacyRecurringPrice(staticPrice)
            ? staticPrice.recurring_interval
            : product.recurring_interval || undefined
        }
        intervalCount={product.recurring_interval_count}
      />
    )
  } else if (staticPrice && isSeatBasedPrice(staticPrice)) {
    const tiers = staticPrice.seat_tiers.tiers

    // Show the starting tier price with "from" indicator if multiple tiers
    if (tiers.length > 0) {
      const firstTier = tiers[0]
      const hasMultipleTiers = tiers.length > 1

      return (
        <span className="inline-flex items-baseline gap-1.5">
          {hasMultipleTiers && (
            <span className="dark:text-polar-500 text-xs text-gray-500">
              From
            </span>
          )}
          <AmountLabel
            amount={firstTier.price_per_seat}
            currency={staticPrice.price_currency}
            interval={product.recurring_interval || undefined}
          />
          <span className="dark:text-polar-500 text-xs text-gray-500">
            / seat
          </span>
        </span>
      )
    }
    return null
  } else if (staticPrice && isUnitBasedPrice(staticPrice)) {
    const tiers = staticPrice.tiers.tiers

    if (tiers.length > 0) {
      const firstTier = tiers[0]
      const hasMultipleTiers = tiers.length > 1

      return (
        <span className="inline-flex items-baseline gap-1.5">
          {hasMultipleTiers && (
            <span className="dark:text-polar-500 text-xs text-gray-500">
              From
            </span>
          )}
          <AmountLabel
            amount={Number(firstTier.unit_amount)}
            currency={staticPrice.price_currency}
            interval={product.recurring_interval || undefined}
          />
          <span className="dark:text-polar-500 text-xs text-gray-500">
            / {getUnitLabels(staticPrice).unitLabel}
          </span>
        </span>
      )
    }
    return null
  } else if (staticPrice?.amount_type === 'custom') {
    return <span className="text-[min(1em,24px)]">Pay what you want</span>
  }

  const meteredPrice = product.prices.find(
    (price): price is MeteredPrice =>
      price.price_currency === currency && isMeteredPrice(price),
  )

  if (meteredPrice) {
    const { scale, label } = getMeterUnitFormat(
      meteredPrice.meter.unit ?? 'scalar',
      {
        customLabel: meteredPrice.meter.custom_label,
        customMultiplier: meteredPrice.meter.custom_multiplier,
      },
    )
    const tiers =
      meteredPrice.amount_type === 'metered_tiers'
        ? meteredPrice.tiers.tiers
        : []
    const rawAmount =
      tiers.length > 0
        ? Number(tiers[0].unit_amount)
        : meteredPrice.amount_type === 'metered_unit'
          ? Number.parseFloat(meteredPrice.unit_amount)
          : null

    if (rawAmount != null) {
      const hasMultipleTiers = tiers.length > 1

      return (
        <span className="inline-flex items-baseline gap-1.5">
          {hasMultipleTiers && (
            <span className="dark:text-polar-500 text-xs text-gray-500">
              From
            </span>
          )}
          <span>
            {formatCurrency('subcent')(
              rawAmount * scale,
              meteredPrice.price_currency,
            )}
          </span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            / {label}
          </span>
        </span>
      )
    }
  }

  if (staticPrice) {
    return <span className="text-[min(1em,24px)]">Free</span>
  }

  return null
}

export default ProductPriceLabel
