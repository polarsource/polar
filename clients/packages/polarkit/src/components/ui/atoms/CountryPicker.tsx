'use client'

import { CONFIG } from '@/utils/config'
import { countries, getCountryData, getEmojiFlag, TCountryCode } from 'countries-list'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'

const getCountryList = (codes: TCountryCode[]) => {
  return codes.map((countryCode) => ({
    code: countryCode,
    country: getCountryData(countryCode),
    emoji: getEmojiFlag(countryCode),
  })).sort((a, b) => a.country.name.localeCompare(b.country.name))
}

const countryCodes = Object.keys(countries) as TCountryCode[]
const allCountries = getCountryList(countryCodes.filter((countryCode) => {
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
}))

const stripeConnectWhitelist = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(
  ',',
) as TCountryCode[]
const stripeConnectCountries = getCountryList(stripeConnectWhitelist)

const CountryPicker = ({
  value,
  onChange,
  autoComplete,
  stripeConnectOnly = false,
}: {
  value?: string
  onChange: (value: string) => void
  autoComplete?: string
  stripeConnectOnly?: boolean
}) => {
  const countryMap = stripeConnectOnly ? stripeConnectCountries : allCountries
  return (
    <Select onValueChange={onChange} value={value} autoComplete={autoComplete}>
      <SelectTrigger>
        <SelectValue placeholder="Country" />
      </SelectTrigger>
      <SelectContent>
        {countryMap.map(({ code, country, emoji }) => (
          <SelectItem key={code} value={code} textValue={country.name}>
            <div className="flex flex-row gap-2">
              <div>{emoji}</div>
              <div>{country.name}</div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CountryPicker
