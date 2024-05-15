import { formatCurrencyAndAmount } from '@/utils/money'
import { ProductPrice, ProductPriceRecurringInterval } from '@polar-sh/sdk'
import { useMemo } from 'react'

interface ProductPriceLabelProps {
  price: ProductPrice
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ price }) => {
  const { recurring_interval, price_amount, price_currency } = price
  const intervalDisplay = useMemo(() => {
    switch (recurring_interval) {
      case ProductPriceRecurringInterval.MONTH:
        return ' / mo'
      case ProductPriceRecurringInterval.YEAR:
        return ' / yr'
      default:
        return ''
    }
  }, [recurring_interval])

  return (
    <div>
      {formatCurrencyAndAmount(price_amount, price_currency, 0)}
      {intervalDisplay}
    </div>
  )
}

export default ProductPriceLabel
