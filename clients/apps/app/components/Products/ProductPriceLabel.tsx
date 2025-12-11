import { isLegacyRecurringPrice } from '@/utils/price'
import { schemas } from '@polar-sh/client'
import { Text } from '../Shared/Text'
import AmountLabel from './AmountLabel'

interface ProductPriceLabelProps {
  product?: schemas['Product'] | schemas['CheckoutProduct']
  loading?: boolean
}

export const ProductPriceLabel = ({
  product,
  loading,
}: ProductPriceLabelProps) => {
  const staticPrice = product?.prices.find(({ amount_type }) =>
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
        loading={loading}
        interval={
          isLegacyRecurringPrice(staticPrice)
            ? staticPrice.recurring_interval
            : product?.recurring_interval || undefined
        }
      />
    )
  } else if (staticPrice.amount_type === 'custom') {
    return <Text loading={loading}>Pay what you want</Text>
  } else {
    return <Text loading={loading}>Free</Text>
  }
}
