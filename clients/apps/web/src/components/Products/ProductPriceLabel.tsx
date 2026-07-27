import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product: schemas['Product'] | schemas['CheckoutProduct']
  currency: string
}

function isSeatBasedPrice(
  price: schemas['ProductPrice'],
): price is schemas['ProductPriceSeatBased'] {
  return price.amount_type === 'seat_based'
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  currency,
}: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(
    ({ amount_type, price_currency }) =>
      price_currency === currency &&
      ['fixed', 'custom', 'seat_based'].includes(amount_type),
  )

  if (!staticPrice) {
    return null
  }

  if (staticPrice.amount_type === 'fixed' && staticPrice.price_amount !== 0) {
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
  } else if (isSeatBasedPrice(staticPrice)) {
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
  } else if (staticPrice.amount_type === 'custom') {
    return <span className="text-[min(1em,24px)]">Pay what you want</span>
  } else {
    return <span className="text-[min(1em,24px)]">Free</span>
  }
}

export default ProductPriceLabel
