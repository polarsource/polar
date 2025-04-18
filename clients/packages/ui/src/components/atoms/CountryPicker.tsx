'use client'

import {
  countries,
  getCountryData,
  getEmojiFlag,
  TCountryCode,
} from 'countries-list'

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

const countryCodes = Object.keys(countries) as TCountryCode[]
const allCountries = getCountryList(
  countryCodes.filter((countryCode) => {
    switch (countryCode.toUpperCase()) {
      // US Trade Embargos (Stripe can check regions)
      case 'CU':
      case 'IR':
      case 'KP':
      case 'SY':
      case 'RU':
        return false
      default:
        return true
    }
  }),
)

const CountryPicker = ({
  value,
  onChange,
  autoComplete,
  allowedCountries,
  className,
  itemClassName,
  contentClassName,
}: {
  value?: string
  onChange: (value: string) => void
  autoComplete?: string
  allowedCountries?: string[]
  className?: string
  itemClassName?: string
  contentClassName?: string
}) => {
  const countryMap = allowedCountries
    ? getCountryList(allowedCountries as TCountryCode[])
    : allCountries
  return (
    <Select onValueChange={onChange} value={value} autoComplete={autoComplete}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Country" />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {countryMap.map(({ code, country, emoji }) => (
          <SelectItem
            key={code}
            value={code}
            textValue={country.name}
            className={itemClassName}
          >
            {emoji} {country.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CountryPicker
