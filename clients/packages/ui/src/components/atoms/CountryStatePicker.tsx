'use client'

import { Input } from '@polar-sh/orbit'
import { FIXED_STATE_OPTIONS } from '../../lib/states'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'

export {
  COUNTRIES_WITH_FIXED_STATE_OPTIONS,
  FIXED_STATE_OPTIONS,
  getStateLabel,
  hasFixedStateOptions,
} from '../../lib/states'

const CountryStatePicker = ({
  className,
  value,
  onChange,
  country,
  autoComplete,
  itemClassName,
  contentClassName,
  disabled,
  placeholder = 'State',
  fallbackPlaceholder = 'State / Province',
}: {
  className?: string
  contentClassName?: string
  itemClassName?: string
  value?: string
  onChange: (value: string) => void
  country?: string
  autoComplete?: string
  disabled?: boolean
  placeholder?: string
  fallbackPlaceholder?: string
}) => {
  const states = country ? FIXED_STATE_OPTIONS[country] : undefined
  if (states) {
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
        <SelectContent className={contentClassName} translate="no">
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
      placeholder={fallbackPlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  )
}

export default CountryStatePicker
