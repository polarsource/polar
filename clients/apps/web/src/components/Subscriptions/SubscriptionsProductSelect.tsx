import { FilterOption } from '@/components/Shared/FilterPopover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'

export interface ProductFilter {
  product_id: string | null
  external_product_id: string | null
}

interface SubscriptionsProductSelectProps {
  options: FilterOption[]
  value: string | null
  onChange: (value: string | null) => void
}

const SubscriptionsProductSelect: React.FC<SubscriptionsProductSelectProps> = ({
  options,
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
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionsProductSelect
