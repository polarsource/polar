import type { OrderStatusFilter } from '@/utils/order'
import { enums } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'
import { OrderStatusDisplayTitle } from './OrderStatus'

interface OrderStatusSelectProps {
  value: OrderStatusFilter
  onChange: (value: OrderStatusFilter) => void
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select
      value={value}
      onValueChange={(value) => onChange(value as OrderStatusFilter)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Any status</span>
        </SelectItem>
        <SelectSeparator />
        {enums.orderStatusValues.map((status) => (
          <SelectItem key={status} value={status}>
            {OrderStatusDisplayTitle[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default OrderStatusSelect
