import { LoopOutlined, ShoppingCartOutlined } from '@mui/icons-material'
import { components } from '@polar-sh/client'
import React from 'react'

interface ProductPriceTypeIconProps {
  productPriceType: components['schemas']['ProductPriceType']
}

const ProductPriceTypeIcon: React.FC<ProductPriceTypeIconProps> = ({
  productPriceType,
}) => {
  switch (productPriceType) {
    case 'one_time':
      return <ShoppingCartOutlined fontSize="inherit" />
    case 'recurring':
      return <LoopOutlined fontSize="inherit" />
    default:
      return null
  }
}

export default ProductPriceTypeIcon
