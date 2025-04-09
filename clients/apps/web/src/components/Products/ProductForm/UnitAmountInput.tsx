import Input from '@polar-sh/ui/components/atoms/Input'
import React, { useCallback, useMemo } from 'react'

interface UnitAmountInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange: (value: number) => void
}

const UnitAmountInput: React.ForwardRefExoticComponent<
  UnitAmountInputProps & React.RefAttributes<HTMLInputElement>
> = React.forwardRef((props, ref) => {
  const { value, onValueChange, ...rest } = props
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
    return formatter.format(parsed / 100)
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
      const cents = parsed * 100
      onValueChange(cents)
    },
    [onValueChange],
  )

  return (
    <Input
      ref={ref}
      {...rest}
      type="text"
      inputMode="decimal"
      value={parsedValue}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />
  )
})

UnitAmountInput.displayName = 'UnitAmountInput'

export default UnitAmountInput
