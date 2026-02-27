'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { enums } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import React from 'react'

interface CurrencyTabsProps {
  activeCurrencies: string[]
  selectedCurrency: string
  onSelectCurrency: (currency: string) => void
  onAddCurrency: (currency: string) => void
  onRemoveCurrency: (currency: string) => void
  defaultCurrency: string
}

export const CurrencyTabs: React.FC<CurrencyTabsProps> = ({
  activeCurrencies,
  selectedCurrency,
  onSelectCurrency,
  onAddCurrency,
  onRemoveCurrency,
  defaultCurrency,
}) => {
  const availableCurrencies = enums.presentmentCurrencyValues.filter(
    (c: string) => !activeCurrencies.includes(c),
  )

  return (
    <div className="flex flex-col gap-y-4 py-6">
      <div className="flex flex-row items-center justify-between gap-x-6">
        <h3 className="">Currencies</h3>

        {availableCurrencies.length > 0 && (
          <Select onValueChange={onAddCurrency}>
            <SelectTrigger className="h-8 w-auto rounded-md">
              <span className="text-xs text-black dark:text-white">
                Add Currency
              </span>
            </SelectTrigger>
            <SelectContent>
              {availableCurrencies.map((currency: string) => (
                <SelectItem key={currency} value={currency}>
                  {currency.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Tabs value={selectedCurrency} onValueChange={onSelectCurrency}>
          <TabsList className="h-auto flex-wrap">
            {activeCurrencies.map((currency) => (
              <TabsTrigger
                key={currency}
                value={currency}
                className="flex h-8 items-center gap-2"
              >
                <span>{currency.toUpperCase()}</span>
                {currency !== defaultCurrency &&
                  selectedCurrency === currency && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveCurrency(currency)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onRemoveCurrency(currency)
                        }
                      }}
                      className="dark:text-polar-400 dark:hover:text-polar-200 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-600"
                    >
                      <CloseOutlined fontSize="inherit" />
                    </span>
                  )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
