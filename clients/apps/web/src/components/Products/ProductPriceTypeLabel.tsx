import { ProductPriceType } from '@polar-sh/sdk'
import React from 'react'

interface ProductPriceTypeLabelProps {
  productPriceType: ProductPriceType
}

const ProductPriceTypeLabel: React.FC<ProductPriceTypeLabelProps> = ({
  productPriceType,
}) => {
  switch (productPriceType) {
    case ProductPriceType.ONE_TIME:
      return 'One-time purchase'
    case ProductPriceType.RECURRING:
      return 'Subscription'
    default:
      return null
  }
}

export default ProductPriceTypeLabel
