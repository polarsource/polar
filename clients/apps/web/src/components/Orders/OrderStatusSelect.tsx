import { enums, schemas } from '@polar-sh/client'
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
  value: schemas['OrderStatus'] | null
  onChange: (value: schemas['OrderStatus'] | null) => void
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select
      value={value ?? 'any'}
      onValueChange={(value) =>
        onChange(value === 'any' ? null : (value as schemas['OrderStatus']))
      }
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
