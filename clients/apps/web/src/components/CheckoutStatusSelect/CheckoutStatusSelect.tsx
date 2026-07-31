import { CheckoutStatusDisplayTitle } from '@/utils/checkout'
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

interface CheckoutStatusSelectProps {
  value: schemas['CheckoutStatus'] | null
  onChange: (value: schemas['CheckoutStatus'] | null) => void
}

const CheckoutStatusSelect: React.FC<CheckoutStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select
      value={value ?? 'any'}
      onValueChange={(value) =>
        onChange(value === 'any' ? null : (value as schemas['CheckoutStatus']))
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
        {enums.checkoutStatusValues.map((status) => (
          <SelectItem key={status} value={status}>
            {CheckoutStatusDisplayTitle[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CheckoutStatusSelect
