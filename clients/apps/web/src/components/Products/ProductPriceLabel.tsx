import {
  ProductPrice,
  ProductPriceRecurringInterval,
  ProductPriceType,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useMemo } from 'react'

interface ProductPriceLabelProps {
  price: ProductPrice
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ price }) => {
  const { price_amount, price_currency } = price
  const intervalDisplay = useMemo(() => {
    switch (price.type) {
      case ProductPriceType.ONE_TIME:
        return ''
      case ProductPriceType.RECURRING:
        switch (price.recurring_interval) {
          case ProductPriceRecurringInterval.MONTH:
            return ' / mo'
          case ProductPriceRecurringInterval.YEAR:
            return ' / yr'
          default:
            return ''
        }
    }
  }, [price])

  return (
    <div>
      <span className="text-sm">
        {formatCurrencyAndAmount(price_amount, price_currency, 0)}
      </span>
      <span className="text-xs">{intervalDisplay}</span>
    </div>
  )
}

export default ProductPriceLabel
