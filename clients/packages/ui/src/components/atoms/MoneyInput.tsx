import { getCurrencyDecimalFactor, isDecimalCurrency } from '@polar-sh/currency'
import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import Input from './Input'

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
}

const MoneyInput = (props: Props) => {
  let {
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
  } = props

  const decimalFactor = useMemo(
    () => getCurrencyDecimalFactor(currency),
    [currency],
  )
  const isNonDecimalCurrency = !isDecimalCurrency(currency)

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

  useEffect(() => {
    if (value !== previousValue) {
      setPreviousValue(value)
      setInternalValue(getInternalValue(value))
    }
  }, [value, previousValue, getInternalValue])

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

      // Strip everything except numbers, commas, and periods
      // (people can paste in anything, so the keydown handler is not enough)
      const cleaned = input.replace(/[^0-9,.]/g, '')

      // By default, parse the full value as a whole number, stripping out decimal separators
      //
      // Leave a trailing comma, otherwise people can't type in decimals
      // (the onBlur handler will strip it if it's dangling on blur)
      let newValue = cleaned.replace(/[,.](?!$)/g, '').replace(/,$/, '.')

      // However, if we detect a decimal separator, round it to 2 decimal places
      //
      // We support period decimal separator (enforced when typing)
      // but also support comma decimal separators (might be pasted in)
      const decimalMatch = cleaned.match(/([.,])([0-9]+)$/)

      if (decimalMatch) {
        const maxDecimalPrecision = 2
        const decimalPart = decimalMatch[2]
        const integerPart = cleaned
          .slice(0, -decimalMatch[0].length)
          .replace(/[,.]/g, '')
        const trimmedDecimalPart = decimalPart.slice(0, maxDecimalPrecision)

        const parsedValue = Number.parseFloat(
          `${integerPart}.${trimmedDecimalPart}`,
        )

        if (!Number.isNaN(parsedValue)) {
          const decimalPlaces = Math.min(
            maxDecimalPrecision,
            decimalPart.length,
          )
          const formatted = parsedValue.toFixed(decimalPlaces)

          // This covers when the user deletes the last integer part and prevents inserting a `0`
          // in place of the last integer part that would make the caret jump to the end of the input
          // This way the user can continue typing
          newValue =
            integerPart.length > 0
              ? formatted
              : formatted.replace(/^0(?=\.)/, '')
        }
      }

      updateValue(newValue)
    },
    [updateValue, isNonDecimalCurrency],
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

      // Prevent multiple decimal points
      if (
        (e.key === '.' || e.key === ',') &&
        e.currentTarget.value.includes('.')
      ) {
        e.preventDefault()
      }
    },
    [step, updateValue, isNonDecimalCurrency],
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
        'dark:placeholder:text-polar-500 block w-full px-4 pl-14 text-base font-normal placeholder:text-gray-400',
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
