import LoopOutlined from '@mui/icons-material/LoopOutlined'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import { schemas } from '@polar-sh/client'
import React from 'react'

interface ProductPriceTypeIconProps {
  productPriceType: schemas['ProductPriceType']
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
