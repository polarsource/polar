'use client'

import Input from './Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select'

const US_STATES: Record<string, string> = {
  'US-AL': 'Alabama',
  'US-AK': 'Alaska',
  'US-AZ': 'Arizona',
  'US-AR': 'Arkansas',
  'US-CA': 'California',
  'US-CO': 'Colorado',
  'US-CT': 'Connecticut',
  'US-DE': 'Delaware',
  'US-FL': 'Florida',
  'US-GA': 'Georgia',
  'US-HI': 'Hawaii',
  'US-ID': 'Idaho',
  'US-IL': 'Illinois',
  'US-IN': 'Indiana',
  'US-IA': 'Iowa',
  'US-KS': 'Kansas',
  'US-KY': 'Kentucky',
  'US-LA': 'Louisiana',
  'US-ME': 'Maine',
  'US-MD': 'Maryland',
  'US-MA': 'Massachusetts',
  'US-MI': 'Michigan',
  'US-MN': 'Minnesota',
  'US-MS': 'Mississippi',
  'US-MO': 'Missouri',
  'US-MT': 'Montana',
  'US-NE': 'Nebraska',
  'US-NV': 'Nevada',
  'US-NH': 'New Hampshire',
  'US-NJ': 'New Jersey',
  'US-NM': 'New Mexico',
  'US-NY': 'New York',
  'US-NC': 'North Carolina',
  'US-ND': 'North Dakota',
  'US-OH': 'Ohio',
  'US-OK': 'Oklahoma',
  'US-OR': 'Oregon',
  'US-PA': 'Pennsylvania',
  'US-RI': 'Rhode Island',
  'US-SC': 'South Carolina',
  'US-SD': 'South Dakota',
  'US-TN': 'Tennessee',
  'US-TX': 'Texas',
  'US-UT': 'Utah',
  'US-VT': 'Vermont',
  'US-VA': 'Virginia',
  'US-WA': 'Washington',
  'US-WV': 'West Virginia',
  'US-WI': 'Wisconsin',
  'US-WY': 'Wyoming',
  'US-DC': 'District of Columbia',
}

const CA_PROVINCES: Record<string, string> = {
  'CA-AB': 'Alberta',
  'CA-BC': 'British Columbia',
  'CA-MB': 'Manitoba',
  'CA-NB': 'New Brunswick',
  'CA-NL': 'Newfoundland and Labrador',
  'CA-NS': 'Nova Scotia',
  'CA-ON': 'Ontario',
  'CA-PE': 'Prince Edward Island',
  'CA-QC': 'Quebec',
  'CA-SK': 'Saskatchewan',
}

const CountryStatePicker = ({
  className,
  value,
  onChange,
  country,
  autoComplete,
  itemClassName,
  contentClassName,
}: {
  className?: string
  contentClassName?: string
  itemClassName?: string
  value?: string
  onChange: (value: string) => void
  country?: string
  autoComplete?: string
}) => {
  if (country === 'US' || country === 'CA') {
    const states = country === 'US' ? US_STATES : CA_PROVINCES
    return (
      <Select
        onValueChange={onChange}
        value={value}
        autoComplete={autoComplete}
      >
        <SelectTrigger className={className}>
          <SelectValue
            placeholder={country === 'US' ? 'State' : 'Province'}
            // Avoids issues due to browser automatic translation
            // https://github.com/shadcn-ui/ui/issues/852
            translate="no"
          />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {Object.entries(states).map(([code, name]) => (
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

  return (
    <Input
      type="text"
      placeholder="State / Province"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default CountryStatePicker
