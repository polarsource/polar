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
    return (
      <div className="flex items-center gap-1">
        <AmountLabel
          amount={(staticPrice as any).price_per_seat}
          currency={(staticPrice as any).price_currency}
          interval={
            isLegacyRecurringPrice(staticPrice)
              ? (staticPrice as any).recurring_interval
              : product.recurring_interval || undefined
          }
        />
      </div>
    )
  } else if (staticPrice.amount_type === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
