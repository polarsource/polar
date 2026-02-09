'use client'

import { useMemo } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select'

const CountryPicker = ({
  allowedCountries,
  locale,
  value,
  onChange,
  autoComplete,
  disabled,
  className,
  itemClassName,
  contentClassName,
  placeholder = 'Country',
}: {
  allowedCountries: readonly string[]
  locale?: string
  value?: string
  onChange: (value: string) => void
  autoComplete?: string
  disabled?: boolean
  className?: string
  itemClassName?: string
  contentClassName?: string
  placeholder?: string
}) => {
  const countryList = useMemo(() => {
    const displayNames = new Intl.DisplayNames(locale ? [locale] : [], {
      type: 'region',
    })
    return allowedCountries
      .map((code) => ({
        code,
        name: displayNames.of(code) ?? code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [allowedCountries, locale])

  return (
    <Select
      onValueChange={onChange}
      value={value}
      autoComplete={autoComplete}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={placeholder}
          // Avoids issues due to browser automatic translation
          // https://github.com/shadcn-ui/ui/issues/852
          translate="no"
        />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {countryList.map(({ code, name }) => (
          <SelectItem
            key={code}
            value={code}
            textValue={name}
            className={itemClassName}
          >
            {/* Wrap in div to workaround an issue with browser automatic translation
              https://github.com/shadcn-ui/ui/issues/852 */}
            <div>{name}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CountryPicker
