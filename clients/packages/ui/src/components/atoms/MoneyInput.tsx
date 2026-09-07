import {
  getCurrencyDecimalFactor,
  getLocaleDecimalSeparator,
  isDecimalCurrency,
  parseMoneyValue,
} from '@polar-sh/currency'
import { ChangeEvent, FocusEvent, useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Input } from '@polar-sh/orbit'

interface Props {
  name: string
  placeholder: number
  currency: string
  id?: string
  onChange?: (value: number | null) => void
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  value?: number | null
  className?: string
  disabled?: boolean
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
  step?: number
  locale?: string
}

const MoneyInput = (props: Props) => {
  const {
    id,
    name,
    value,
    placeholder,
    currency,
    preSlot,
    postSlot,
    onChange: _onChange,
    onBlur: _onBlur,
    onFocus,
    disabled,
    step = 0.1,
    locale = 'en',
  } = props

  const decimalFactor = useMemo(
    () => getCurrencyDecimalFactor(currency),
    [currency],
  )
  const isNonDecimalCurrency = !isDecimalCurrency(currency)
  const decimalSeparator = useMemo(
    () => getLocaleDecimalSeparator(locale),
    [locale],
  )

  const getInternalValue = useCallback(
    (value: number | null | undefined): string | undefined => {
      if (value === undefined || value === null) {
        return undefined
      }
      if (isNonDecimalCurrency) {
        return value.toString()
      }
      return (value / decimalFactor).toFixed(2)
    },
    [decimalFactor, isNonDecimalCurrency],
  )

  const getUnits = useCallback(
    (value: string): number => {
      let newAmount = Number.parseFloat(value)
      if (isNaN(newAmount)) {
        newAmount = 0
      }
      if (isNonDecimalCurrency) {
        return Math.round(newAmount)
      }
      // Round to avoid floating point errors
      return Math.round(newAmount * decimalFactor)
    },
    [decimalFactor, isNonDecimalCurrency],
  )

  const [previousValue, setPreviousValue] = useState<number | null | undefined>(
    value,
  )
  const [internalValue, setInternalValue] = useState<string | undefined>(
    getInternalValue(value),
  )

  if (value !== previousValue) {
    setPreviousValue(value)
    setInternalValue(getInternalValue(value))
  }

  const updateValue = useCallback(
    (newValue: string) => {
      if (_onChange) {
        if (!newValue || newValue.trim() === '') {
          setPreviousValue(null)
          _onChange(null)
        } else {
          const unitsValue = getUnits(newValue)
          setPreviousValue(unitsValue)
          _onChange(unitsValue)
        }
      }

      setInternalValue(newValue)
    },
    [_onChange, getUnits],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value

      // If input is completely empty, allow clearing the field
      if (input === '') {
        updateValue('')
        return
      }

      // For non-decimal currencies, only allow whole numbers
      if (isNonDecimalCurrency) {
        const cleaned = input.replace(/[^0-9]/g, '')
        updateValue(cleaned)
        return
      }

      // Locale-aware parsing of the typed/pasted value. For period-decimal
      // locales (en, …) a comma is a thousands separator so "5,000" stays 5000;
      // for comma-decimal locales (de, …) a comma is the decimal separator so
      // "12,50" becomes 12.50. See @polar-sh/currency `parseMoneyValue`.
      updateValue(parseMoneyValue(input, decimalSeparator))
    },
    [updateValue, isNonDecimalCurrency, decimalSeparator],
  )

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (internalValue) {
        let nextValue = internalValue

        if (!isNonDecimalCurrency) {
          // Add 0 as integer part if value starts with `.`
          if (nextValue.startsWith('.')) {
            nextValue = `0${nextValue}`
          }

          // Strip trailing decimal point
          if (nextValue.endsWith('.')) {
            nextValue = nextValue.replace(/\.$/, '')
          }
        }

        if (nextValue !== internalValue) {
          updateValue(nextValue)
        }
      }

      if (_onBlur) {
        _onBlur(e)
      }
    },
    [_onBlur, internalValue, updateValue, isNonDecimalCurrency],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // For non-decimal currencies, only allow digits and control keys
      if (isNonDecimalCurrency) {
        if (
          !/[0-9]/.test(e.key) &&
          !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(
            e.key,
          ) &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault()
        }
        return
      }

      // Allow only digits, decimal point, and control keys
      if (
        !/[0-9.,]/.test(e.key) &&
        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(
          e.key,
        ) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const parsedValue = Number.parseFloat(e.currentTarget.value)

        const newValue = (
          !Number.isNaN(parsedValue) ? parsedValue + step : step
        ).toFixed(2)

        updateValue(newValue)
      }

      if (e.key === 'ArrowDown') {
        const parsedValue = Number.parseFloat(e.currentTarget.value)

        const newValue = Math.max(
          0,
          !Number.isNaN(parsedValue) ? parsedValue - step : -step,
        ).toFixed(2)

        updateValue(newValue)
      }

      // Prevent multiple decimal points. The committed value is displayed with
      // a period (toFixed), and the locale's own decimal separator may be a
      // comma, so block a second separator once either is already present.
      if (
        (e.key === '.' || e.key === ',') &&
        (e.currentTarget.value.includes(decimalSeparator) ||
          e.currentTarget.value.includes('.'))
      ) {
        e.preventDefault()
      }
    },
    [step, updateValue, isNonDecimalCurrency, decimalSeparator],
  )

  const currencyLabel = (
    <span className="dark:text-polar-500 text-sm font-medium text-gray-500">
      {currency.toUpperCase()}
    </span>
  )

  const placeholderValue = useMemo(() => {
    if (!placeholder) return undefined
    if (isNonDecimalCurrency) {
      return placeholder.toLocaleString('en-US')
    }
    return (placeholder / decimalFactor).toLocaleString('en-US')
  }, [placeholder, decimalFactor, isNonDecimalCurrency])

  return (
    <Input
      type="text"
      inputMode={isNonDecimalCurrency ? 'numeric' : 'decimal'}
      id={id}
      name={name}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 pl-14 text-base placeholder:text-gray-400',
        props.className ?? '',
      )}
      value={internalValue}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholderValue}
      preSlot={preSlot ? preSlot : currencyLabel}
      postSlot={postSlot}
      onBlur={onBlur}
      onFocus={onFocus}
      disabled={disabled}
    />
  )
}

export default MoneyInput
