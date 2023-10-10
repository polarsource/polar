import { countries } from 'countries-list'
import { CONFIG } from 'polarkit'

const countryWhiteList = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(',')

const availableCountries = Object.entries(countries)
  .sort((a, b) => {
    return a[1].name.localeCompare(b[1].name)
  })
  .filter(([countryCode]) => countryWhiteList.includes(countryCode))

const CountryPicker = ({
  onSelectCountry,
}: {
  onSelectCountry: (countryCode: string) => void
}) => {
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectCountry(e.target.value)
  }

  return (
    <select
      onChange={onChange}
      className="font-display dark:border-polar-500 block w-full rounded-lg border-gray-200 bg-transparent px-4 py-2 pr-12 shadow-sm transition-colors focus:z-10 focus:border-blue-500 focus:ring-blue-500"
    >
      {availableCountries.map(([countryCode, country]) => {
        return (
          <option
            key={countryCode}
            value={countryCode}
            selected={countryCode === 'US'}
          >
            {country.emoji} {country.name}
          </option>
        )
      })}
    </select>
  )
}

export default CountryPicker
