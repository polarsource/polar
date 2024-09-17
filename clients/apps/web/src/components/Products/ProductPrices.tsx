'use client'

import {
  ProductPrice,
  ProductPriceType,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductPrices {
  prices: ProductPrice[]
}

const ProductPrices: React.FC<ProductPrices> = ({ prices }) => {
  if (prices.length === 0) {
    return <></>
  }

  if (prices.length === 1) {
    const price = prices[0]
    return <ProductPriceLabel price={price} />
  }

  if (prices.length > 1) {
    const monthlyPrice = prices.find(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === SubscriptionRecurringInterval.MONTH,
    )
    const yearlyPrice = prices.find(
      (price) =>
        price.type === ProductPriceType.RECURRING &&
        price.recurring_interval === SubscriptionRecurringInterval.YEAR,
    )
    return (
      <div className="flex gap-1">
        {monthlyPrice && <ProductPriceLabel price={monthlyPrice} />}
        <div>-</div>
        {yearlyPrice && <ProductPriceLabel price={yearlyPrice} />}
      </div>
    )
  }

  return <></>
}

export default ProductPrices
