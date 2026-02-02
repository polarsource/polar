import { CheckoutStatusDisplayTitle } from '@/utils/checkout'
import { enums } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import React from 'react'

interface CheckoutStatusSelectProps {
  value: string
  onChange: (value: string) => void
}

const CheckoutStatusSelect: React.FC<CheckoutStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        {enums.checkoutStatusValues.map((status) => (
          <React.Fragment key={status}>
            <SelectGroup>
              <SelectItem value={status} className="font-medium">
                <div className="flex items-center gap-2 whitespace-normal">
                  {CheckoutStatusDisplayTitle[status]}
                </div>
              </SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CheckoutStatusSelect
