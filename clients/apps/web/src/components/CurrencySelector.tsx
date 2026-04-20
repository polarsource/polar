'use client'

import { enums, schemas } from '@polar-sh/client'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import { useCallback, useMemo, useState } from 'react'

interface CurrencySelectorProps {
  value?: schemas['PresentmentCurrency'] | null
  onChange: (value: string) => void
  disabled?: boolean
  excludeCurrencies?: string[]
  placeholder?: string
  className?: string
}

const formatter = new Intl.DisplayNames('en-US', { type: 'currency' })

type CurrencyItem = { code: string; label: string }

const labelOverrides: Record<string, string> = {
  aed: 'UAE Dirham',
  bam: 'Bosnian Convertible Mark',
  xcg: 'Carribean Guilder',
}

const pinnedCodes = ['usd', 'eur', 'gbp']

const allCurrencies: CurrencyItem[] = enums.presentmentCurrencyValues
  .map((code) => ({
    code,
    label: labelOverrides[code] ?? formatter.of(code) ?? code.toUpperCase(),
  }))
  .sort((a, b) => {
    const aPin = pinnedCodes.indexOf(a.code)
    const bPin = pinnedCodes.indexOf(b.code)
    if (aPin !== -1 && bPin !== -1) return aPin - bPin
    if (aPin !== -1) return -1
    if (bPin !== -1) return 1
    return a.label.localeCompare(b.label)
  })

export const CurrencySelector = ({
  value,
  onChange,
  disabled,
  excludeCurrencies,
  placeholder = 'Select currency',
  className,
}: CurrencySelectorProps) => {
  const [query, setQuery] = useState('')

  const baseCurrencies = useMemo(() => {
    if (!excludeCurrencies || excludeCurrencies.length === 0)
      return allCurrencies
    return allCurrencies.filter((c) => !excludeCurrencies.includes(c.code))
  }, [excludeCurrencies])

  const filteredCurrencies = useMemo(() => {
    if (!query) return baseCurrencies
    const q = query.toLowerCase()
    return baseCurrencies.filter(
      ({ code, label }) => code.includes(q) || label.toLowerCase().includes(q),
    )
  }, [query, baseCurrencies])

  const selectedItem = useMemo(
    () =>
      value ? (allCurrencies.find((c) => c.code === value) ?? null) : null,
    [value],
  )

  const handleChange = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        onChange(newValue)
      }
    },
    [onChange],
  )

  return (
    <Combobox
      items={filteredCurrencies}
      value={value ?? null}
      selectedItem={selectedItem}
      onChange={handleChange}
      onQueryChange={setQuery}
      getItemValue={(item) => item.code}
      getItemLabel={(item) => item.label}
      renderItem={(item) => (
        <span className="flex flex-1 items-center gap-2">
          <span className="w-8 text-black/50 group-data-[selected=true]:text-white/60 dark:text-white/30">
            {item.code.toUpperCase()}
          </span>
          <span className="truncate">{item.label}</span>
        </span>
      )}
      placeholder={placeholder}
      searchPlaceholder="Search currencies…"
      emptyLabel="No currencies found"
      popoverClassName="min-w-[250px]"
      popoverAlign="end"
      className={disabled ? 'pointer-events-none opacity-50' : className}
    />
  )
}
