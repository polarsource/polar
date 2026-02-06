'use client'

import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
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
  const currency = prices[0].price_currency

  if (prices.length === 1) {
    return <ProductPriceLabel product={product} currency={currency} />
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
          <ProductPriceLabel
            product={{ ...product, prices: [monthlyPrice] }}
            currency={currency}
          />
        )}
        <div>-</div>
        {yearlyPrice && (
          <ProductPriceLabel
            product={{ ...product, prices: [yearlyPrice] }}
            currency={currency}
          />
        )}
      </div>
    )
  }

  return <></>
}

export default LegacyRecurringProductPrices
