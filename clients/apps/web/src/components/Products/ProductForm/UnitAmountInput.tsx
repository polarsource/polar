import { getCurrencyDecimalFactor } from '@polar-sh/currency'
import Input from '@polar-sh/ui/components/atoms/Input'
import Big from 'big.js'
import React, {
  ComponentProps,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

const UnitAmountInput = ({
  ref,
  currency,
  ...props
}: ComponentProps<typeof Input> & {
  currency: string
  onValueChange: (value: number) => void
}) => {
  const { value, onValueChange, className, ...rest } = props

  const decimalFactor = useMemo(
    () => getCurrencyDecimalFactor(currency),
    [currency],
  )
  const isNonDecimalCurrency = decimalFactor === 1

  const toDisplay = useCallback(
    (v: unknown): string => {
      if (typeof v !== 'string' && typeof v !== 'number') return ''
      const parsed = typeof v === 'number' ? v : Number.parseFloat(v)
      if (isNaN(parsed)) return ''
      if (isNonDecimalCurrency) return String(Math.round(parsed))
      return new Big(parsed).div(decimalFactor).toString()
    },
    [decimalFactor, isNonDecimalCurrency],
  )

  const [displayValue, setDisplayValue] = useState(() => toDisplay(value))
  const lastEmittedRef = useRef<number | null>(null)

  // Sync from external value changes (e.g. currency switch), but skip if
  // the change originated from our own onChange to preserve user's typed text.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    // eslint-disable-next-line react-hooks/refs -- comparing against last emitted value to avoid overwriting user input
    if (typeof value !== 'number' || value !== lastEmittedRef.current) {
      setDisplayValue(toDisplay(value))
    }
  }

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
        !/[0-9.]/.test(e.key) &&
        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(
          e.key,
        ) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault()
      }

      // Prevent multiple decimal points
      if (e.key === '.' && e.currentTarget.value.includes('.')) {
        e.preventDefault()
      }
    },
    [isNonDecimalCurrency],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      setDisplayValue(input)

      if (input === '' || input.endsWith('.')) return

      const parsed = Number.parseFloat(input)
      if (isNaN(parsed)) return

      let units: number
      if (isNonDecimalCurrency) {
        units = Math.round(parsed)
      } else {
        units = new Big(parsed).times(decimalFactor).toNumber()
      }

      lastEmittedRef.current = units
      onValueChange(units)
    },
    [onValueChange, decimalFactor, isNonDecimalCurrency],
  )

  const currencyLabel = (
    <span className="dark:text-polar-500 text-sm font-medium text-gray-500">
      {currency.toUpperCase()}
    </span>
  )

  return (
    <Input
      ref={ref}
      {...rest}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 pl-14 text-base font-normal placeholder:text-gray-400',
        className ?? '',
      )}
      type="text"
      inputMode={isNonDecimalCurrency ? 'numeric' : 'decimal'}
      value={displayValue}
      onKeyDown={onKeyDown}
      onChange={onChange}
      preSlot={currencyLabel}
    />
  )
}

UnitAmountInput.displayName = 'UnitAmountInput'

export default UnitAmountInput
