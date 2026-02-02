'use client'

import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@spaire/client'
import ProductPriceLabel from './ProductPriceLabel'

interface LegacyRecurringProductPricesProps {
  product: (
    | schemas['Product']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
  ) & {
    prices: schemas['LegacyRecurringProductPrice'][]
  }
}

const LegacyRecurringProductPrices: React.FC<
  LegacyRecurringProductPricesProps
> = ({ product }) => {
  const { prices } = product

  if (prices.length === 1) {
    return <ProductPriceLabel product={product} />
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
          <ProductPriceLabel product={{ ...product, prices: [monthlyPrice] }} />
        )}
        <div>-</div>
        {yearlyPrice && (
          <ProductPriceLabel product={{ ...product, prices: [yearlyPrice] }} />
        )}
      </div>
    )
  }

  return <></>
}

export default LegacyRecurringProductPrices
