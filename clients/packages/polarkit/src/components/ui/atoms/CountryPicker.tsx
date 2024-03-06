'use client'

import { Command } from 'cmdk'
import { CONFIG } from 'polarkit'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Check, ChevronsUpDown } from 'lucide-react'
import React from 'react'
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '../command'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'
import { RawButton } from './Button'

const countryWhiteList = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(',')

const countries = [
  ['AF', { emoji: '🇦🇫', name: 'Afghanistan' }],
  ['AX', { emoji: '🇦🇽', name: 'Åland' }],
  ['AL', { emoji: '🇦🇱', name: 'Albania' }],
  ['DZ', { emoji: '🇩🇿', name: 'Algeria' }],
  ['AS', { emoji: '🇦🇸', name: 'American Samoa' }],
  ['AD', { emoji: '🇦🇩', name: 'Andorra' }],
  ['AO', { emoji: '🇦🇴', name: 'Angola' }],
  ['AI', { emoji: '🇦🇮', name: 'Anguilla' }],
  ['AQ', { emoji: '🇦🇶', name: 'Antarctica' }],
  ['AG', { emoji: '🇦🇬', name: 'Antigua and Barbuda' }],
  ['AR', { emoji: '🇦🇷', name: 'Argentina' }],
  ['AM', { emoji: '🇦🇲', name: 'Armenia' }],
  ['AW', { emoji: '🇦🇼', name: 'Aruba' }],
  ['AU', { emoji: '🇦🇺', name: 'Australia' }],
  ['AT', { emoji: '🇦🇹', name: 'Austria' }],
  ['AZ', { emoji: '🇦🇿', name: 'Azerbaijan' }],
  ['BS', { emoji: '🇧🇸', name: 'Bahamas' }],
  ['BH', { emoji: '🇧🇭', name: 'Bahrain' }],
  ['BD', { emoji: '🇧🇩', name: 'Bangladesh' }],
  ['BB', { emoji: '🇧🇧', name: 'Barbados' }],
  ['BY', { emoji: '🇧🇾', name: 'Belarus' }],
  ['BE', { emoji: '🇧🇪', name: 'Belgium' }],
  ['BZ', { emoji: '🇧🇿', name: 'Belize' }],
  ['BJ', { emoji: '🇧🇯', name: 'Benin' }],
  ['BM', { emoji: '🇧🇲', name: 'Bermuda' }],
  ['BT', { emoji: '🇧🇹', name: 'Bhutan' }],
  ['BO', { emoji: '🇧🇴', name: 'Bolivia' }],
  ['BQ', { emoji: '🇧🇶', name: 'Bonaire' }],
  ['BA', { emoji: '🇧🇦', name: 'Bosnia and Herzegovina' }],
  ['BW', { emoji: '🇧🇼', name: 'Botswana' }],
  ['BV', { emoji: '🇧🇻', name: 'Bouvet Island' }],
  ['BR', { emoji: '🇧🇷', name: 'Brazil' }],
  ['IO', { emoji: '🇮🇴', name: 'British Indian Ocean Territory' }],
  ['VG', { emoji: '🇻🇬', name: 'British Virgin Islands' }],
  ['BN', { emoji: '🇧🇳', name: 'Brunei' }],
  ['BG', { emoji: '🇧🇬', name: 'Bulgaria' }],
  ['BF', { emoji: '🇧🇫', name: 'Burkina Faso' }],
  ['BI', { emoji: '🇧🇮', name: 'Burundi' }],
  ['KH', { emoji: '🇰🇭', name: 'Cambodia' }],
  ['CM', { emoji: '🇨🇲', name: 'Cameroon' }],
  ['CA', { emoji: '🇨🇦', name: 'Canada' }],
  ['CV', { emoji: '🇨🇻', name: 'Cape Verde' }],
  ['KY', { emoji: '🇰🇾', name: 'Cayman Islands' }],
  ['CF', { emoji: '🇨🇫', name: 'Central African Republic' }],
  ['TD', { emoji: '🇹🇩', name: 'Chad' }],
  ['CL', { emoji: '🇨🇱', name: 'Chile' }],
  ['CN', { emoji: '🇨🇳', name: 'China' }],
  ['CX', { emoji: '🇨🇽', name: 'Christmas Island' }],
  ['CC', { emoji: '🇨🇨', name: 'Cocos [Keeling] Islands' }],
  ['CO', { emoji: '🇨🇴', name: 'Colombia' }],
  ['KM', { emoji: '🇰🇲', name: 'Comoros' }],
  ['CK', { emoji: '🇨🇰', name: 'Cook Islands' }],
  ['CR', { emoji: '🇨🇷', name: 'Costa Rica' }],
  ['HR', { emoji: '🇭🇷', name: 'Croatia' }],
  ['CU', { emoji: '🇨🇺', name: 'Cuba' }],
  ['CW', { emoji: '🇨🇼', name: 'Curacao' }],
  ['CY', { emoji: '🇨🇾', name: 'Cyprus' }],
  ['CZ', { emoji: '🇨🇿', name: 'Czech Republic' }],
  ['CD', { emoji: '🇨🇩', name: 'Democratic Republic of the Congo' }],
  ['DK', { emoji: '🇩🇰', name: 'Denmark' }],
  ['DJ', { emoji: '🇩🇯', name: 'Djibouti' }],
  ['DM', { emoji: '🇩🇲', name: 'Dominica' }],
  ['DO', { emoji: '🇩🇴', name: 'Dominican Republic' }],
  ['TL', { emoji: '🇹🇱', name: 'East Timor' }],
  ['EC', { emoji: '🇪🇨', name: 'Ecuador' }],
  ['EG', { emoji: '🇪🇬', name: 'Egypt' }],
  ['SV', { emoji: '🇸🇻', name: 'El Salvador' }],
  ['GQ', { emoji: '🇬🇶', name: 'Equatorial Guinea' }],
  ['ER', { emoji: '🇪🇷', name: 'Eritrea' }],
  ['EE', { emoji: '🇪🇪', name: 'Estonia' }],
  ['ET', { emoji: '🇪🇹', name: 'Ethiopia' }],
  ['FK', { emoji: '🇫🇰', name: 'Falkland Islands' }],
  ['FO', { emoji: '🇫🇴', name: 'Faroe Islands' }],
  ['FJ', { emoji: '🇫🇯', name: 'Fiji' }],
  ['FI', { emoji: '🇫🇮', name: 'Finland' }],
  ['FR', { emoji: '🇫🇷', name: 'France' }],
  ['GF', { emoji: '🇬🇫', name: 'French Guiana' }],
  ['PF', { emoji: '🇵🇫', name: 'French Polynesia' }],
  ['TF', { emoji: '🇹🇫', name: 'French Southern Territories' }],
  ['GA', { emoji: '🇬🇦', name: 'Gabon' }],
  ['GM', { emoji: '🇬🇲', name: 'Gambia' }],
  ['GE', { emoji: '🇬🇪', name: 'Georgia' }],
  ['DE', { emoji: '🇩🇪', name: 'Germany' }],
  ['GH', { emoji: '🇬🇭', name: 'Ghana' }],
  ['GI', { emoji: '🇬🇮', name: 'Gibraltar' }],
  ['GR', { emoji: '🇬🇷', name: 'Greece' }],
  ['GL', { emoji: '🇬🇱', name: 'Greenland' }],
  ['GD', { emoji: '🇬🇩', name: 'Grenada' }],
  ['GP', { emoji: '🇬🇵', name: 'Guadeloupe' }],
  ['GU', { emoji: '🇬🇺', name: 'Guam' }],
  ['GT', { emoji: '🇬🇹', name: 'Guatemala' }],
  ['GG', { emoji: '🇬🇬', name: 'Guernsey' }],
  ['GN', { emoji: '🇬🇳', name: 'Guinea' }],
  ['GW', { emoji: '🇬🇼', name: 'Guinea-Bissau' }],
  ['GY', { emoji: '🇬🇾', name: 'Guyana' }],
  ['HT', { emoji: '🇭🇹', name: 'Haiti' }],
  ['HM', { emoji: '🇭🇲', name: 'Heard Island and McDonald Islands' }],
  ['HN', { emoji: '🇭🇳', name: 'Honduras' }],
  ['HK', { emoji: '🇭🇰', name: 'Hong Kong' }],
  ['HU', { emoji: '🇭🇺', name: 'Hungary' }],
  ['IS', { emoji: '🇮🇸', name: 'Iceland' }],
  ['IN', { emoji: '🇮🇳', name: 'India' }],
  ['ID', { emoji: '🇮🇩', name: 'Indonesia' }],
  ['IR', { emoji: '🇮🇷', name: 'Iran' }],
  ['IQ', { emoji: '🇮🇶', name: 'Iraq' }],
  ['IE', { emoji: '🇮🇪', name: 'Ireland' }],
  ['IM', { emoji: '🇮🇲', name: 'Isle of Man' }],
  ['IL', { emoji: '🇮🇱', name: 'Israel' }],
  ['IT', { emoji: '🇮🇹', name: 'Italy' }],
  ['CI', { emoji: '🇨🇮', name: 'Ivory Coast' }],
  ['JM', { emoji: '🇯🇲', name: 'Jamaica' }],
  ['JP', { emoji: '🇯🇵', name: 'Japan' }],
  ['JE', { emoji: '🇯🇪', name: 'Jersey' }],
  ['JO', { emoji: '🇯🇴', name: 'Jordan' }],
  ['KZ', { emoji: '🇰🇿', name: 'Kazakhstan' }],
  ['KE', { emoji: '🇰🇪', name: 'Kenya' }],
  ['KI', { emoji: '🇰🇮', name: 'Kiribati' }],
  ['XK', { emoji: '🇽🇰', name: 'Kosovo' }],
  ['KW', { emoji: '🇰🇼', name: 'Kuwait' }],
  ['KG', { emoji: '🇰🇬', name: 'Kyrgyzstan' }],
  ['LA', { emoji: '🇱🇦', name: 'Laos' }],
  ['LV', { emoji: '🇱🇻', name: 'Latvia' }],
  ['LB', { emoji: '🇱🇧', name: 'Lebanon' }],
  ['LS', { emoji: '🇱🇸', name: 'Lesotho' }],
  ['LR', { emoji: '🇱🇷', name: 'Liberia' }],
  ['LY', { emoji: '🇱🇾', name: 'Libya' }],
  ['LI', { emoji: '🇱🇮', name: 'Liechtenstein' }],
  ['LT', { emoji: '🇱🇹', name: 'Lithuania' }],
  ['LU', { emoji: '🇱🇺', name: 'Luxembourg' }],
  ['MO', { emoji: '🇲🇴', name: 'Macao' }],
  ['MG', { emoji: '🇲🇬', name: 'Madagascar' }],
  ['MW', { emoji: '🇲🇼', name: 'Malawi' }],
  ['MY', { emoji: '🇲🇾', name: 'Malaysia' }],
  ['MV', { emoji: '🇲🇻', name: 'Maldives' }],
  ['ML', { emoji: '🇲🇱', name: 'Mali' }],
  ['MT', { emoji: '🇲🇹', name: 'Malta' }],
  ['MH', { emoji: '🇲🇭', name: 'Marshall Islands' }],
  ['MQ', { emoji: '🇲🇶', name: 'Martinique' }],
  ['MR', { emoji: '🇲🇷', name: 'Mauritania' }],
  ['MU', { emoji: '🇲🇺', name: 'Mauritius' }],
  ['YT', { emoji: '🇾🇹', name: 'Mayotte' }],
  ['MX', { emoji: '🇲🇽', name: 'Mexico' }],
  ['FM', { emoji: '🇫🇲', name: 'Micronesia' }],
  ['MD', { emoji: '🇲🇩', name: 'Moldova' }],
  ['MC', { emoji: '🇲🇨', name: 'Monaco' }],
  ['MN', { emoji: '🇲🇳', name: 'Mongolia' }],
  ['ME', { emoji: '🇲🇪', name: 'Montenegro' }],
  ['MS', { emoji: '🇲🇸', name: 'Montserrat' }],
  ['MA', { emoji: '🇲🇦', name: 'Morocco' }],
  ['MZ', { emoji: '🇲🇿', name: 'Mozambique' }],
  ['MM', { emoji: '🇲🇲', name: 'Myanmar [Burma]' }],
  ['NA', { emoji: '🇳🇦', name: 'Namibia' }],
  ['NR', { emoji: '🇳🇷', name: 'Nauru' }],
  ['NP', { emoji: '🇳🇵', name: 'Nepal' }],
  ['NL', { emoji: '🇳🇱', name: 'Netherlands' }],
  ['NC', { emoji: '🇳🇨', name: 'New Caledonia' }],
  ['NZ', { emoji: '🇳🇿', name: 'New Zealand' }],
  ['NI', { emoji: '🇳🇮', name: 'Nicaragua' }],
  ['NE', { emoji: '🇳🇪', name: 'Niger' }],
  ['NG', { emoji: '🇳🇬', name: 'Nigeria' }],
  ['NU', { emoji: '🇳🇺', name: 'Niue' }],
  ['NF', { emoji: '🇳🇫', name: 'Norfolk Island' }],
  ['KP', { emoji: '🇰🇵', name: 'North Korea' }],
  ['MK', { emoji: '🇲🇰', name: 'North Macedonia' }],
  ['MP', { emoji: '🇲🇵', name: 'Northern Mariana Islands' }],
  ['NO', { emoji: '🇳🇴', name: 'Norway' }],
  ['OM', { emoji: '🇴🇲', name: 'Oman' }],
  ['PK', { emoji: '🇵🇰', name: 'Pakistan' }],
  ['PW', { emoji: '🇵🇼', name: 'Palau' }],
  ['PS', { emoji: '🇵🇸', name: 'Palestine' }],
  ['PA', { emoji: '🇵🇦', name: 'Panama' }],
  ['PG', { emoji: '🇵🇬', name: 'Papua New Guinea' }],
  ['PY', { emoji: '🇵🇾', name: 'Paraguay' }],
  ['PE', { emoji: '🇵🇪', name: 'Peru' }],
  ['PH', { emoji: '🇵🇭', name: 'Philippines' }],
  ['PN', { emoji: '🇵🇳', name: 'Pitcairn Islands' }],
  ['PL', { emoji: '🇵🇱', name: 'Poland' }],
  ['PT', { emoji: '🇵🇹', name: 'Portugal' }],
  ['PR', { emoji: '🇵🇷', name: 'Puerto Rico' }],
  ['QA', { emoji: '🇶🇦', name: 'Qatar' }],
  ['CG', { emoji: '🇨🇬', name: 'Republic of the Congo' }],
  ['RE', { emoji: '🇷🇪', name: 'Réunion' }],
  ['RO', { emoji: '🇷🇴', name: 'Romania' }],
  ['RU', { emoji: '🇷🇺', name: 'Russia' }],
  ['RW', { emoji: '🇷🇼', name: 'Rwanda' }],
  ['BL', { emoji: '🇧🇱', name: 'Saint Barthélemy' }],
  ['SH', { emoji: '🇸🇭', name: 'Saint Helena' }],
  ['KN', { emoji: '🇰🇳', name: 'Saint Kitts and Nevis' }],
  ['LC', { emoji: '🇱🇨', name: 'Saint Lucia' }],
  ['MF', { emoji: '🇲🇫', name: 'Saint Martin' }],
  ['PM', { emoji: '🇵🇲', name: 'Saint Pierre and Miquelon' }],
  ['VC', { emoji: '🇻🇨', name: 'Saint Vincent and the Grenadines' }],
  ['WS', { emoji: '🇼🇸', name: 'Samoa' }],
  ['SM', { emoji: '🇸🇲', name: 'San Marino' }],
  ['ST', { emoji: '🇸🇹', name: 'São Tomé and Príncipe' }],
  ['SA', { emoji: '🇸🇦', name: 'Saudi Arabia' }],
  ['SN', { emoji: '🇸🇳', name: 'Senegal' }],
  ['RS', { emoji: '🇷🇸', name: 'Serbia' }],
  ['SC', { emoji: '🇸🇨', name: 'Seychelles' }],
  ['SL', { emoji: '🇸🇱', name: 'Sierra Leone' }],
  ['SG', { emoji: '🇸🇬', name: 'Singapore' }],
  ['SX', { emoji: '🇸🇽', name: 'Sint Maarten' }],
  ['SK', { emoji: '🇸🇰', name: 'Slovakia' }],
  ['SI', { emoji: '🇸🇮', name: 'Slovenia' }],
  ['SB', { emoji: '🇸🇧', name: 'Solomon Islands' }],
  ['SO', { emoji: '🇸🇴', name: 'Somalia' }],
  ['ZA', { emoji: '🇿🇦', name: 'South Africa' }],
  ['GS', { emoji: '🇬🇸', name: 'South Georgia and the South Sandwich Islands' }],
  ['KR', { emoji: '🇰🇷', name: 'South Korea' }],
  ['SS', { emoji: '🇸🇸', name: 'South Sudan' }],
  ['ES', { emoji: '🇪🇸', name: 'Spain' }],
  ['LK', { emoji: '🇱🇰', name: 'Sri Lanka' }],
  ['SD', { emoji: '🇸🇩', name: 'Sudan' }],
  ['SR', { emoji: '🇸🇷', name: 'Suriname' }],
  ['SJ', { emoji: '🇸🇯', name: 'Svalbard and Jan Mayen' }],
  ['SZ', { emoji: '🇸🇿', name: 'Swaziland' }],
  ['SE', { emoji: '🇸🇪', name: 'Sweden' }],
  ['CH', { emoji: '🇨🇭', name: 'Switzerland' }],
  ['SY', { emoji: '🇸🇾', name: 'Syria' }],
  ['TW', { emoji: '🇹🇼', name: 'Taiwan' }],
  ['TJ', { emoji: '🇹🇯', name: 'Tajikistan' }],
  ['TZ', { emoji: '🇹🇿', name: 'Tanzania' }],
  ['TH', { emoji: '🇹🇭', name: 'Thailand' }],
  ['TG', { emoji: '🇹🇬', name: 'Togo' }],
  ['TK', { emoji: '🇹🇰', name: 'Tokelau' }],
  ['TO', { emoji: '🇹🇴', name: 'Tonga' }],
  ['TT', { emoji: '🇹🇹', name: 'Trinidad and Tobago' }],
  ['TN', { emoji: '🇹🇳', name: 'Tunisia' }],
  ['TR', { emoji: '🇹🇷', name: 'Turkey' }],
  ['TM', { emoji: '🇹🇲', name: 'Turkmenistan' }],
  ['TC', { emoji: '🇹🇨', name: 'Turks and Caicos Islands' }],
  ['TV', { emoji: '🇹🇻', name: 'Tuvalu' }],
  ['UM', { emoji: '🇺🇲', name: 'U.S. Minor Outlying Islands' }],
  ['VI', { emoji: '🇻🇮', name: 'U.S. Virgin Islands' }],
  ['UG', { emoji: '🇺🇬', name: 'Uganda' }],
  ['UA', { emoji: '🇺🇦', name: 'Ukraine' }],
  ['AE', { emoji: '🇦🇪', name: 'United Arab Emirates' }],
  ['GB', { emoji: '🇬🇧', name: 'United Kingdom' }],
  ['US', { emoji: '🇺🇸', name: 'United States' }],
  ['UY', { emoji: '🇺🇾', name: 'Uruguay' }],
  ['UZ', { emoji: '🇺🇿', name: 'Uzbekistan' }],
  ['VU', { emoji: '🇻🇺', name: 'Vanuatu' }],
  ['VA', { emoji: '🇻🇦', name: 'Vatican City' }],
  ['VE', { emoji: '🇻🇪', name: 'Venezuela' }],
  ['VN', { emoji: '🇻🇳', name: 'Vietnam' }],
  ['WF', { emoji: '🇼🇫', name: 'Wallis and Futuna' }],
  ['EH', { emoji: '🇪🇭', name: 'Western Sahara' }],
  ['YE', { emoji: '🇾🇪', name: 'Yemen' }],
  ['ZM', { emoji: '🇿🇲', name: 'Zambia' }],
  ['ZW', { emoji: '🇿🇼', name: 'Zimbabwe' }],
] as const

const availableCountries = countries.filter(([countryCode]) =>
  countryWhiteList.includes(countryCode),
)

const CountryPicker = ({
  onSelectCountry,
}: {
  onSelectCountry: (countryCode: string) => void
}) => {
  const onChange = (val: string) => {
    onSelectCountry(val)
    setValue(val)
  }

  const [value, setValue] = useState('US')
  const [open, setOpen] = React.useState(false)

  const currentCountry = availableCountries.find(
    ([countryCode]) => countryCode === value,
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <RawButton
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full"
        >
          <div className="inline-flex w-full items-center justify-between">
            {currentCountry ? (
              <span className="flex-1  text-left">
                {currentCountry[1].emoji} {currentCountry[1].name}
              </span>
            ) : (
              <span className="flex-1 text-left">Select country</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </RawButton>
      </PopoverTrigger>
      <PopoverContent
        className="-mt-10 w-[400px] p-0 lg:min-w-[600px]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search country..." className="my-2 h-8" />
          <CommandEmpty>No country found.</CommandEmpty>
          <CommandGroup>
            {availableCountries.map(([countryCode, country]) => (
              <CommandItem
                key={countryCode}
                value={country.name}
                onSelect={() => {
                  onChange(countryCode)
                  setOpen(false)
                }}
              >
                <Check
                  className={twMerge(
                    'mr-2 h-4 w-4',
                    value === countryCode ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {country.emoji} {country.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default CountryPicker
