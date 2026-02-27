import { getCurrencyDecimalFactor } from '@polar-sh/currency'
import Input from '@polar-sh/ui/components/atoms/Input'
import Big from 'big.js'
import React, { ComponentProps, useCallback, useMemo } from 'react'
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

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumIntegerDigits: 1,
        minimumSignificantDigits: 1,
        maximumFractionDigits: isNonDecimalCurrency ? 0 : 14,
      }),
    [isNonDecimalCurrency],
  )

  const parsedValue: string | undefined = useMemo(() => {
    if (typeof value !== 'string') {
      return undefined
    }
    const parsed = Number.parseFloat(value)
    if (isNaN(parsed)) {
      return undefined
    }
    if (isNonDecimalCurrency) {
      return formatter.format(parsed)
    }
    return formatter.format(new Big(parsed).div(decimalFactor).toNumber())
  }, [value, formatter, decimalFactor, isNonDecimalCurrency])

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
      const value = e.target.value
      const parsed = Number.parseFloat(value)
      if (isNaN(parsed)) {
        return
      }
      if (isNonDecimalCurrency) {
        onValueChange(Math.round(parsed))
        return
      }
      const units = new Big(parsed).times(decimalFactor).toNumber()
      onValueChange(units)
    },
    [onValueChange, decimalFactor, isNonDecimalCurrency],
  )

  const currencyLabel = (
    // eslint-disable-next-line no-restricted-syntax
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
      value={parsedValue}
      onKeyDown={onKeyDown}
      onChange={onChange}
      preSlot={currencyLabel}
    />
  )
}

UnitAmountInput.displayName = 'UnitAmountInput'

export default UnitAmountInput
