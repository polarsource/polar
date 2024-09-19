import { Product } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import React from 'react'

interface SubscriptionTiersSelectProps {
  products: Product[]
  value: string
  onChange: (value: string) => void
}

const SubscriptionTiersSelect: React.FC<SubscriptionTiersSelectProps> = ({
  products,
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="whitespace-nowrap">All plans</span>
        </SelectItem>
        <SelectSeparator />
        {products.map((product) => (
          <SelectItem key={product.id} value={product.id}>
            {product.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionTiersSelect
