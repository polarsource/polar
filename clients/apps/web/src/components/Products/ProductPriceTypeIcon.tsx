import { LoopOutlined, ShoppingCartOutlined } from '@mui/icons-material'
import { ProductPriceType } from '@polar-sh/sdk'
import React from 'react'

interface ProductPriceTypeIconProps {
  productPriceType: ProductPriceType
}

const ProductPriceTypeIcon: React.FC<ProductPriceTypeIconProps> = ({
  productPriceType,
}) => {
  switch (productPriceType) {
    case ProductPriceType.ONE_TIME:
      return <ShoppingCartOutlined fontSize="inherit" />
    case ProductPriceType.RECURRING:
      return <LoopOutlined fontSize="inherit" />
    default:
      return null
  }
}

export default ProductPriceTypeIcon
