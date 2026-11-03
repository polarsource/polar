import React from 'react'

export type ProductPriceType = 'one_time' | 'recurring'

interface ProductPriceTypeLabelProps {
  productPriceType: ProductPriceType
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
