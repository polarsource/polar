import { schemas } from '@spaire/client'
import React from 'react'

interface ProductPriceTypeLabelProps {
  productPriceType: schemas['ProductPriceType']
}

const ProductPriceTypeLabel: React.FC<ProductPriceTypeLabelProps> = ({
  productPriceType,
}) => {
  switch (productPriceType) {
    case 'one_time':
      return 'One-time purchase'
    case 'recurring':
      return 'Subscription'
    default:
      return null
  }
}

export default ProductPriceTypeLabel
