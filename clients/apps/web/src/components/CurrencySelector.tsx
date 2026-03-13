'use client'

import { enums, schemas } from '@polar-sh/client'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import { useCallback, useMemo, useState } from 'react'

interface CurrencySelectorProps {
  value: schemas['PresentmentCurrency']
  onChange: (value: string) => void
  disabled?: boolean
}

const formatter = new Intl.DisplayNames('en-US', { type: 'currency' })

type CurrencyItem = { code: string; label: string }

const labelOverrides: Record<string, string> = {
  aed: 'UAE Dirham',
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
}: CurrencySelectorProps) => {
  const [query, setQuery] = useState('')

  const filteredCurrencies = useMemo(() => {
    if (!query) return allCurrencies
    const q = query.toLowerCase()
    return allCurrencies.filter(
      ({ code, label }) => code.includes(q) || label.toLowerCase().includes(q),
    )
  }, [query])

  const selectedItem = useMemo(
    () => allCurrencies.find((c) => c.code === value) ?? null,
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
      value={value}
      selectedItem={selectedItem}
      onChange={handleChange}
      onQueryChange={setQuery}
      getItemValue={(item) => item.code}
      getItemLabel={(item) => item.label}
      renderItem={(item) => (
        <span className="flex flex-1 items-center gap-2">
          <span className="text-muted-foreground w-8 group-data-[selected=true]:text-white/60">
            {item.code.toUpperCase()}
          </span>
          <span className="truncate">{item.label}</span>
        </span>
      )}
      placeholder="Select currency"
      searchPlaceholder="Search currencies…"
      emptyLabel="No currencies found"
      popoverClassName="min-w-[230px]"
      popoverAlign="end"
      className={disabled ? 'pointer-events-none opacity-50' : undefined}
    />
  )
}
