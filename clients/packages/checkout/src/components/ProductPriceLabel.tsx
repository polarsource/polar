import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import AmountLabel from './AmountLabel'

interface ProductPriceLabelProps {
  price: ProductPrice
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ price }) => {
  if (price.amountType === 'fixed') {
    return (
      <AmountLabel
        amount={price.priceAmount}
        currency={price.priceCurrency}
        interval={
          price.type === 'recurring' ? price.recurringInterval : undefined
        }
      />
    )
  } else if (price.amountType === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
