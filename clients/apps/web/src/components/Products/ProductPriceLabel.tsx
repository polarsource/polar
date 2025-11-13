import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product:
    | schemas['Product']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
}

function isSeatBasedPrice(
  price: schemas['ProductPrice'],
): price is schemas['ProductPriceSeatBased'] {
  return price.amount_type === 'seat_based'
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
}: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(({ amount_type }) =>
    ['fixed', 'custom', 'free', 'seat_based'].includes(amount_type),
  )

  if (!staticPrice) {
    return null
  }

  if (staticPrice.amount_type === 'fixed') {
    return (
      <AmountLabel
        amount={staticPrice.price_amount}
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
      const hasFlatFee = 'flat_fee' in firstTier && firstTier.flat_fee !== undefined

      if (hasFlatFee) {
        // Flat fee pricing
        const minSeats = firstTier.min_seats
        const maxSeats = firstTier.max_seats
        const seatRange = maxSeats ? `${minSeats}-${maxSeats}` : `${minSeats}+`

        return (
          <div className="flex items-baseline gap-1.5">
            {hasMultipleTiers && (
              <span className="dark:text-polar-500 text-xs text-gray-500">
                From
              </span>
            )}
            <AmountLabel
              amount={firstTier.flat_fee}
              interval={product.recurring_interval || undefined}
            />
            <span className="dark:text-polar-500 text-xs text-gray-500">
              for {seatRange} seats
            </span>
          </div>
        )
      } else {
        // Per-seat pricing
        return (
          <div className="flex items-baseline gap-1.5">
            {hasMultipleTiers && (
              <span className="dark:text-polar-500 text-xs text-gray-500">
                From
              </span>
            )}
            <AmountLabel
              amount={firstTier.price_per_seat || 0}
              interval={product.recurring_interval || undefined}
            />
            <span className="dark:text-polar-500 text-xs text-gray-500">
              / seat
            </span>
          </div>
        )
      }
    }
    return null
  } else if (staticPrice.amount_type === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
