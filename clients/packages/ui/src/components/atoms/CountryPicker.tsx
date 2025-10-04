'use client'

import { getCountryData, getEmojiFlag, TCountryCode } from 'countries-list'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select'

const getCountryList = (codes: TCountryCode[]) => {
  return codes
    .map((countryCode) => ({
      code: countryCode,
      country: getCountryData(countryCode),
      emoji: getEmojiFlag(countryCode),
    }))
    .sort((a, b) => a.country.name.localeCompare(b.country.name))
}

const CountryPicker = ({
  allowedCountries,
  value,
  onChange,
  autoComplete,
  className,
  itemClassName,
  contentClassName,
}: {
  allowedCountries: readonly string[]
  value?: string
  onChange: (value: string) => void
  autoComplete?: string
  className?: string
  itemClassName?: string
  contentClassName?: string
}) => {
  const countryMap = getCountryList(allowedCountries as TCountryCode[])
  return (
    <Select onValueChange={onChange} value={value} autoComplete={autoComplete}>
      <SelectTrigger className={className}>
        <SelectValue
          placeholder="Country"
          // Avoids issues due to browser automatic translation
          // https://github.com/shadcn-ui/ui/issues/852
          translate="no"
        />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {countryMap.map(({ code, country }) => (
          <SelectItem
            key={code}
            value={code}
            textValue={country.name}
            className={itemClassName}
          >
            {/* Wrap in div to workaround an issue with browser automatic translation
              https://github.com/shadcn-ui/ui/issues/852 */}
            <div>{country.name}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CountryPicker
