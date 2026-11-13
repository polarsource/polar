'use client'

import { FIXED_STATE_OPTIONS } from '@polar-sh/ui/lib/states'
import { Input } from './Input'
import {
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useCoarsePointer,
} from './Select'

export {
  COUNTRIES_WITH_FIXED_STATE_OPTIONS,
  FIXED_STATE_OPTIONS,
} from '@polar-sh/ui/lib/states'

const CountryStatePicker = ({
  className,
  name,
  value,
  onChange,
  country,
  autoComplete,
  itemClassName,
  contentClassName,
  disabled,
  placeholder = 'State',
  fallbackPlaceholder = 'State / Province',
  'data-testid': testId,
}: {
  className?: string
  contentClassName?: string
  itemClassName?: string
  name?: string
  value?: string
  onChange: (value: string) => void
  country?: string
  autoComplete?: string
  disabled?: boolean
  placeholder?: string
  fallbackPlaceholder?: string
  'data-testid'?: string
}) => {
  const states = country ? FIXED_STATE_OPTIONS[country] : undefined
  const coarsePointer = useCoarsePointer()

  if (states && coarsePointer) {
    return (
      <NativeSelect
        className={className}
        data-testid={testId}
        name={name}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(states).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </NativeSelect>
    )
  }

  if (states) {
    return (
      <Select
        name={name}
        onValueChange={onChange}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
      >
        <SelectTrigger className={className} data-testid={testId}>
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
      data-testid={testId}
      type="text"
      name={name}
      autoComplete={autoComplete}
      placeholder={fallbackPlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  )
}

export default CountryStatePicker
