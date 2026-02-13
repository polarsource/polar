'use client'

import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

interface CurrencySelectorProps {
  value: schemas['PresentmentCurrency']
  onChange: (value: string) => void
  disabled?: boolean
}

export const CurrencySelector = ({
  value,
  onChange,
  disabled,
}: CurrencySelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {enums.presentmentCurrencyValues.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {currency.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
