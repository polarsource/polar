import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product:
    | schemas['Product']
    | schemas['TransactionProduct']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
  price: schemas['ProductPrice']
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  price,
}) => {
  if (price.amount_type === 'fixed') {
    return (
      <AmountLabel
        amount={price.price_amount}
        currency={price.price_currency}
        interval={
          isLegacyRecurringPrice(price)
            ? price.recurring_interval
            : product.recurring_interval || undefined
        }
      />
    )
  } else if (price.amount_type === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
