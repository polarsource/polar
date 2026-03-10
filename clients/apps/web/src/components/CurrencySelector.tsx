'use client'

import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useMemo } from 'react'

interface CurrencySelectorProps {
  value: schemas['PresentmentCurrency']
  onChange: (value: string) => void
  disabled?: boolean
}

const formatter = new Intl.DisplayNames('en-US', { type: 'currency' })

const formatCurrencyName = (currency: schemas['PresentmentCurrency']) => {
  return formatter.of(currency)
}

export const CurrencySelector = ({
  value,
  onChange,
  disabled,
}: CurrencySelectorProps) => {
  const sortedCurrencies = useMemo(() => {
    const formatter = new Intl.DisplayNames('en-US', { type: 'currency' })

    return enums.presentmentCurrencyValues
      .map((currency) => [
        currency,
        formatter.of(currency) ?? currency.toLocaleUpperCase(),
      ])
      .sort(([, a], [, b]) => a.localeCompare(b))
  }, [])

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select currency" />
      </SelectTrigger>
      <SelectContent>
        {sortedCurrencies.map(([currency, label]) => (
          <SelectItem key={currency} value={currency}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
