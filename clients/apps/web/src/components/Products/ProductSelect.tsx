import { Product, ProductPriceType } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import React, { useMemo } from 'react'
import ProductPriceTypeIcon from './ProductPriceTypeIcon'
import ProductPriceTypeLabel from './ProductPriceTypeLabel'

export type ProductSelectType =
  | {
      productPriceType: ProductPriceType
    }
  | { productId: string }

interface ProductSelectProps {
  productsByPriceType: Record<ProductPriceType, Product[]>
  value: ProductSelectType | undefined
  onChange: (value: ProductSelectType | undefined) => void
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  productsByPriceType,
  value: _value,
  onChange: _onChange,
}) => {
  const value = useMemo(() => {
    if (!_value) {
      return 'all'
    }
    if ('productId' in _value) {
      return _value.productId
    }
    return _value.productPriceType
  }, [_value])

  const onChange = (value: ProductPriceType | string | 'all') => {
    if (value === 'all') {
      _onChange(undefined)
    } else if (
      value === ProductPriceType.ONE_TIME ||
      value === ProductPriceType.RECURRING
    ) {
      _onChange({ productPriceType: value })
    } else {
      _onChange({ productId: value })
    }
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a product" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="whitespace-nowrap">All products</span>
        </SelectItem>
        <SelectSeparator />
        {Object.entries(productsByPriceType).map(
          ([productPriceType, products], index) => (
            <React.Fragment key={productPriceType}>
              <SelectGroup>
                <SelectItem value={productPriceType} className="font-medium">
                  <div className="flex items-center gap-2 whitespace-normal">
                    <ProductPriceTypeIcon
                      productPriceType={productPriceType as ProductPriceType}
                    />
                    <ProductPriceTypeLabel
                      productPriceType={productPriceType as ProductPriceType}
                    />
                  </div>
                </SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {index < Object.entries(productsByPriceType).length - 1 && (
                <SelectSeparator />
              )}
            </React.Fragment>
          ),
        )}
      </SelectContent>
    </Select>
  )
}

export default ProductSelect
