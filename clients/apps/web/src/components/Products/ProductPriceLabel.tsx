import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product:
    | schemas['Product']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ product }) => {
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
        currency={staticPrice.price_currency}
        interval={
          isLegacyRecurringPrice(staticPrice)
            ? staticPrice.recurring_interval
            : product.recurring_interval || undefined
        }
      />
    )
  } else if (staticPrice.amount_type === 'seat_based') {
    interface SeatTier {
      min_seats: number
      max_seats: number | null
      price_per_seat: number
    }

    interface SeatBasedPrice {
      price_currency: string
      seat_tiers?: {
        tiers: SeatTier[]
      }
    }

    const seatPrice = staticPrice as unknown as SeatBasedPrice
    const tiers = seatPrice.seat_tiers?.tiers || []

    // Show the starting tier price with "from" indicator if multiple tiers
    if (tiers.length > 0) {
      const firstTier = tiers[0]
      const hasMultipleTiers = tiers.length > 1

      return (
        <div className="flex items-baseline gap-1.5">
          {hasMultipleTiers && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              From
            </span>
          )}
          <AmountLabel
            amount={firstTier.price_per_seat}
            currency={seatPrice.price_currency}
            interval={
              isLegacyRecurringPrice(staticPrice)
                ? (staticPrice as any).recurring_interval
                : product.recurring_interval || undefined
            }
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            /seat
          </span>
        </div>
      )
    }
    return null
  } else if (staticPrice.amount_type === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
