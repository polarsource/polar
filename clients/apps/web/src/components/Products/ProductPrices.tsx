'use client'

import { schemas } from '@polar-sh/client'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductPrices {
  prices: schemas['ProductPrice'][]
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
        price.type === 'recurring' && price.recurring_interval === 'month',
    )
    const yearlyPrice = prices.find(
      (price) =>
        price.type === 'recurring' && price.recurring_interval === 'year',
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
