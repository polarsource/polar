import { DollarSign } from 'lucide-react'
import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import Input from './Input'

interface Props {
  name: string
  placeholder: number
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

const getCents = (value: string): number => {
  let newAmount = Number.parseFloat(value)
  if (isNaN(newAmount)) {
    newAmount = 0
  }
  // Round to avoid floating point errors
  return Math.round(newAmount * 100)
}

const getInternalValue = (
  value: number | null | undefined,
): string | undefined => {
  return value !== undefined && value !== null
    ? (value / 100).toFixed(2)
    : undefined
}

const MoneyInput = (props: Props) => {
  let {
    id,
    name,
    value,
    placeholder,
    preSlot,
    postSlot,
    onChange: _onChange,
    onBlur: _onBlur,
    onFocus,
    disabled,
    step = 0.1,
  } = props
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
  }, [value, previousValue])

  const updateValue = useCallback(
    (newValue: string) => {
      console.log('Updating value to:', newValue)
      if (_onChange) {
        if (!newValue || newValue.trim() === '') {
          setPreviousValue(null)
          _onChange(null)
        } else {
          const centsValue = getCents(newValue)
          setPreviousValue(centsValue)
          _onChange(centsValue)
        }
      }

      setInternalValue(newValue)
    },
    [_onChange],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value

      // If input is completely empty, allow clearing the field
      if (input === '') {
        updateValue('')
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

        const parsedValue = Number.parseFloat(
          `${integerPart}.${decimalPart.slice(0, maxDecimalPrecision)}`,
        )

        if (!Number.isNaN(parsedValue)) {
          newValue = parsedValue.toFixed(
            Math.min(maxDecimalPrecision, decimalPart.length),
          )
        }
      }

      updateValue(newValue)
    },
    [updateValue],
  )

  const onBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      // Strip trailing decimal point
      if (internalValue?.endsWith('.')) {
        const strippedValue = internalValue.replace(/\.$/, '')

        updateValue(strippedValue)
      }

      if (_onBlur) {
        _onBlur(e)
      }
    },
    [_onBlur, internalValue, updateValue],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    [step, updateValue],
  )

  return (
    <Input
      type="text"
      inputMode="decimal"
      id={id}
      name={name}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 pl-8 text-base font-normal placeholder:text-gray-400',
        props.className ?? '',
      )}
      value={internalValue}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder ? `${placeholder / 100}` : undefined}
      preSlot={preSlot ? preSlot : <DollarSign className="h-4 w-4" />}
      postSlot={postSlot}
      onBlur={onBlur}
      onFocus={onFocus}
      disabled={disabled}
    />
  )
}

export default MoneyInput
