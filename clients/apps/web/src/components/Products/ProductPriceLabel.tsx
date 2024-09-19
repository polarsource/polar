import { ProductPrice, ProductPriceType } from '@polar-sh/sdk'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  price: ProductPrice
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ price }) => {
  if (price.amount_type === 'fixed') {
    return (
      <AmountLabel
        amount={price.price_amount}
        currency={price.price_currency}
        interval={
          price.type === ProductPriceType.RECURRING
            ? price.recurring_interval
            : undefined
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
