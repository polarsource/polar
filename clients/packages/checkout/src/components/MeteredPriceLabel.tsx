import type { ProductPriceMeteredUnit } from '@polar-sh/sdk/models/components/productpricemeteredunit.js'
import { formatUnitAmount } from '../utils/money'

interface MeteredPriceLabelProps {
  price: ProductPriceMeteredUnit
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({ price }) => {
  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {formatUnitAmount(
        Number.parseFloat(price.unitAmount),
        price.priceCurrency,
      )}
      <span className="dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500">
        / unit
      </span>
    </div>
  )
}

export default MeteredPriceLabel
