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
  value: string
  onChange: (value: string) => void
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">Any status</SelectItem>
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
