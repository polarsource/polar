import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'

interface ProductPriceLabelProps {
  product: CheckoutProduct
  price: ProductPrice | LegacyRecurringProductPrice
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  price,
}) => {
  if (price.amountType === 'fixed') {
    return (
      <AmountLabel
        amount={price.priceAmount}
        currency={price.priceCurrency}
        interval={
          isLegacyRecurringPrice(price)
            ? price.recurringInterval
            : product.recurringInterval
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
