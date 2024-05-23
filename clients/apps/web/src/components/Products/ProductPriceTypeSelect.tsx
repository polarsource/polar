import { LoopOutlined, ShoppingCartOutlined } from '@mui/icons-material'
import { ProductPriceType } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import React from 'react'

interface ProductPriceTypeSelectProps {
  value: ProductPriceType | 'all'
  onChange: (value: ProductPriceType | 'all') => void
}

const ProductPriceTypeSelect: React.FC<ProductPriceTypeSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Pricing type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="whitespace-nowrap">All products</span>
        </SelectItem>
        <SelectSeparator />
        <SelectItem value={ProductPriceType.ONE_TIME} className="font-medium">
          <div className="flex items-center gap-2 whitespace-normal">
            <ShoppingCartOutlined fontSize="inherit" />
            One-time purchase
          </div>
        </SelectItem>
        <SelectItem value={ProductPriceType.RECURRING} className="font-medium">
          <div className="flex items-center gap-2 whitespace-normal">
            <LoopOutlined fontSize="inherit" />
            Subscription
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export default ProductPriceTypeSelect
