import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'

interface SubscriptionTiersSelectProps {
  products: schemas['Product'][]
  value: string | null
  onChange: (value: string | null) => void
}

const SubscriptionTiersSelect: React.FC<SubscriptionTiersSelectProps> = ({
  products,
  value,
  onChange,
}) => {
  return (
    <Select
      value={value ?? 'all'}
      onValueChange={(value) => onChange(value === 'all' ? null : value)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a product" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="whitespace-nowrap">All products</span>
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
