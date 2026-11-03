import {
  getUnitLabels,
  isMeteredPrice,
  MeteredPrice,
  isSeatBasedPrice,
  isUnitBasedPrice,
} from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import { Fragment } from 'react'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product: Pick<
    schemas['Product'] | schemas['CheckoutProduct'],
    'prices' | 'recurring_interval' | 'recurring_interval_count'
  >
  currency: string
  verbose?: boolean
}

const renderStaticPrice = (
  staticPrice: schemas['ProductPrice'],
  product: ProductPriceLabelProps['product'],
  verbose: boolean | undefined,
): React.ReactNode => {
  const intervalProps = {
    currency: staticPrice.price_currency,
    interval: product.recurring_interval || undefined,
    intervalCount: product.recurring_interval_count,
    oneTime: !product.recurring_interval,
    verbose,
  }

  if (staticPrice.amount_type === 'fixed' && staticPrice.price_amount !== 0) {
    return <AmountLabel amount={staticPrice.price_amount} {...intervalProps} />
  }

  if (isSeatBasedPrice(staticPrice) || isUnitBasedPrice(staticPrice)) {
    const tiers = staticPrice.tiers.tiers
    if (tiers.length === 0) {
      return null
    }

    return (
      <span className="inline-flex items-baseline gap-1.5">
        {tiers.length > 1 && (
          <span className="dark:text-polar-500 text-xs text-gray-500">
            From
          </span>
        )}
        <AmountLabel
          amount={Number(tiers[0].unit_amount)}
          unit={
            isSeatBasedPrice(staticPrice)
              ? 'seat'
              : getUnitLabels(staticPrice).unitLabel
          }
          {...intervalProps}
        />
      </span>
    )
  }

  if (staticPrice.amount_type === 'custom') {
    return <span className="text-[min(1em,24px)]">Pay what you want</span>
  }

  return null
}

const renderMeteredPrice = (meteredPrice: MeteredPrice): React.ReactNode => {
  const { scale, label } = getMeterUnitFormat(
    meteredPrice.meter.unit ?? 'scalar',
    {
      customLabel: meteredPrice.meter.custom_label,
      customMultiplier: meteredPrice.meter.custom_multiplier,
    },
  )
  const tiers =
    meteredPrice.amount_type === 'metered_tiers' ? meteredPrice.tiers.tiers : []
  const rawAmount =
    tiers.length > 0
      ? Number(tiers[0].unit_amount)
      : meteredPrice.amount_type === 'metered_unit'
        ? Number.parseFloat(meteredPrice.unit_amount)
        : null

  if (rawAmount == null) {
    return null
  }

  return (
    <span className="inline-flex items-baseline gap-1.5">
      {tiers.length > 1 && (
        <span className="dark:text-polar-500 text-xs text-gray-500">From</span>
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

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  currency,
  verbose,
}: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(
    ({ amount_type, price_currency }) =>
      price_currency === currency &&
      ['fixed', 'custom', 'seat_based', 'unit_based'].includes(amount_type),
  )
  const meteredPrices = product.prices.filter(
    (price): price is MeteredPrice =>
      price.price_currency === currency && isMeteredPrice(price),
  )

  const staticLabel = staticPrice
    ? renderStaticPrice(staticPrice, product, verbose)
    : null
  const shownMeteredPrices = verbose
    ? meteredPrices
    : staticLabel
      ? []
      : meteredPrices.slice(0, 1)

  const meteredLabels =
    shownMeteredPrices.length > 1
      ? [<span key="meters">{shownMeteredPrices.length} meters</span>]
      : shownMeteredPrices.map(renderMeteredPrice)

  const labels = [staticLabel, ...meteredLabels].filter(Boolean)

  if (labels.length === 0) {
    return staticPrice ? (
      <span className="text-[min(1em,24px)]">Free</span>
    ) : null
  }

  if (labels.length === 1) {
    return labels[0]
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {labels.map((label, index) => (
        <Fragment key={index}>
          {index > 0 && <span>+</span>}
          {label}
        </Fragment>
      ))}
    </span>
  )
}

export default ProductPriceLabel
