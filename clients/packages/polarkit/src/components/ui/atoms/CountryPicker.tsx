'use client'

import { CONFIG } from '@/utils/config'
import { getCountryData, getEmojiFlag, TCountryCode } from 'countries-list'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'

const countryWhiteList = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(
  ',',
) as TCountryCode[]

const availableCountries = countryWhiteList.map((countryCode) => ({
  code: countryCode,
  country: getCountryData(countryCode),
  emoji: getEmojiFlag(countryCode),
}))

const CountryPicker = ({
  value,
  onChange,
  autoComplete,
}: {
  value?: string
  onChange: (value: string) => void
  autoComplete?: string
}) => {
  return (
    <Select onValueChange={onChange} value={value} autoComplete={autoComplete}>
      <SelectTrigger>
        <SelectValue placeholder="Country" />
      </SelectTrigger>
      <SelectContent>
        {availableCountries.map(({ code, country, emoji }) => (
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
