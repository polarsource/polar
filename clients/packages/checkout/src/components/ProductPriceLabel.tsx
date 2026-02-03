import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

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
        intervalCount={product.recurringIntervalCount}
      />
    )
  } else if (price.amountType === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else if (price.amountType === 'free') {
    return <div className="text-[min(1em,24px)]">Free</div>
  } else if (price.amountType === 'metered_unit') {
    return (
      <div className="flex flex-row gap-1 text-[min(1em,24px)]">
        {price.meter.name}
        {' — '}
        <MeteredPriceLabel price={price} />
      </div>
    )
  }
}

export default ProductPriceLabel
