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
import ProductPriceTypeIcon from './ProductPriceTypeIcon'
import ProductPriceTypeLabel from './ProductPriceTypeLabel'

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
            <ProductPriceTypeIcon
              productPriceType={ProductPriceType.ONE_TIME}
            />
            <ProductPriceTypeLabel
              productPriceType={ProductPriceType.ONE_TIME}
            />
          </div>
        </SelectItem>
        <SelectItem value={ProductPriceType.RECURRING} className="font-medium">
          <div className="flex items-center gap-2 whitespace-normal">
            <ProductPriceTypeIcon
              productPriceType={ProductPriceType.RECURRING}
            />
            <ProductPriceTypeLabel
              productPriceType={ProductPriceType.RECURRING}
            />
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export default ProductPriceTypeSelect
