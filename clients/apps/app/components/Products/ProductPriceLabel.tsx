import { isLegacyRecurringPrice } from '@/utils/price'
import { schemas } from '@polar-sh/client'
import { Text } from '../Shared/Text'
import AmountLabel from './AmountLabel'

interface ProductPriceLabelProps {
  product: schemas['Product'] | schemas['CheckoutProduct']
}

export const ProductPriceLabel = ({ product }: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(({ amount_type }) =>
    ['fixed', 'custom', 'free'].includes(amount_type),
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
  } else if (staticPrice.amount_type === 'custom') {
    return <Text>Pay what you want</Text>
  } else {
    return <Text>Free</Text>
  }
}
