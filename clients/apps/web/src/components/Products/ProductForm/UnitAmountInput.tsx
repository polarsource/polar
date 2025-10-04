import Input from '@polar-sh/ui/components/atoms/Input'
import Big from 'big.js'
import { DollarSign } from 'lucide-react'
import React, { ComponentProps, useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const UnitAmountInput = ({
  ref,
  ...props
}: ComponentProps<typeof Input> & {
  onValueChange: (value: number) => void
}) => {
  const { value, onValueChange, className, ...rest } = props
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumIntegerDigits: 1,
        minimumSignificantDigits: 1,
        maximumFractionDigits: 14,
      }),
    [],
  )

  const parsedValue: string | undefined = useMemo(() => {
    if (typeof value !== 'string') {
      return undefined
    }
    const parsed = Number.parseFloat(value)
    if (isNaN(parsed)) {
      return undefined
    }
    return formatter.format(new Big(parsed).div(100).toNumber())
  }, [value, formatter])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
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
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      const parsed = Number.parseFloat(value)
      if (isNaN(parsed)) {
        return
      }
      const cents = new Big(parsed).times(100).toNumber()
      onValueChange(cents)
    },
    [onValueChange],
  )

  return (
    <Input
      ref={ref}
      {...rest}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 pl-8 text-base font-normal placeholder:text-gray-400',
        className ?? '',
      )}
      type="text"
      inputMode="decimal"
      value={parsedValue}
      onKeyDown={onKeyDown}
      onChange={onChange}
      preSlot={<DollarSign className="h-4 w-4" />}
    />
  )
}

UnitAmountInput.displayName = 'UnitAmountInput'

export default UnitAmountInput
