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
  const showTrial =
    product.trialDays && product.trialDays > 0 && product.isRecurring

  if (price.amountType === 'fixed') {
    return (
      <div className="flex flex-col">
        <AmountLabel
          amount={price.priceAmount}
          currency={price.priceCurrency}
          interval={
            isLegacyRecurringPrice(price)
              ? price.recurringInterval
              : product.recurringInterval
          }
        />
        {false && showTrial && (
          <span className="text-sm text-gray-500">
            after {product.trialDays} day{product.trialDays > 1 ? 's' : ''} free
            trial
          </span>
        )}
      </div>
    )
  } else if (price.amountType === 'custom') {
    return (
      <div className="flex flex-col">
        <div className="text-[min(1em,24px)]">Pay what you want</div>
        {showTrial && (
          <span className="text-sm text-gray-500">
            after {product.trialDays} day{product.trialDays > 1 ? 's' : ''} free
            trial
          </span>
        )}
      </div>
    )
  } else if (price.amountType === 'free') {
    return <div className="text-[min(1em,24px)]">Free</div>
  } else if (price.amountType === 'metered_unit') {
    return (
      <div className="flex flex-col">
        <div className="flex flex-row gap-1 text-[min(1em,24px)]">
          {price.meter.name}
          {' — '}
          <MeteredPriceLabel price={price} />
        </div>
        {showTrial && (
          <span className="text-sm text-gray-500">
            after {product.trialDays} day{product.trialDays > 1 ? 's' : ''} free
            trial
          </span>
        )}
      </div>
    )
  }
}

export default ProductPriceLabel
