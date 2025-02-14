'use client'

import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductPrices {
  product:
    | schemas['Product']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
}

const ProductPrices: React.FC<ProductPrices> = ({ product }) => {
  const { prices } = product

  if (prices.length === 1) {
    const price = prices[0]
    return <ProductPriceLabel product={product} price={price} />
  }

  if (prices.length > 1) {
    const monthlyPrice = prices
      .filter(isLegacyRecurringPrice)
      .find((price) => price.recurring_interval === 'month')
    const yearlyPrice = prices
      .filter(isLegacyRecurringPrice)
      .find((price) => price.recurring_interval === 'year')
    return (
      <div className="flex gap-1">
        {monthlyPrice && (
          <ProductPriceLabel product={product} price={monthlyPrice} />
        )}
        <div>-</div>
        {yearlyPrice && (
          <ProductPriceLabel product={product} price={yearlyPrice} />
        )}
      </div>
    )
  }

  return <></>
}

export default ProductPrices
