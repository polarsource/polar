import { Percent } from 'lucide-react'
import { ChangeEvent, FocusEvent, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Input from './Input'

interface Props {
  name: string
  placeholder: number
  id?: string
  onChange?: (value: number) => void
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  value?: number
  className?: string
  disabled?: boolean
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
}

const getPercentageBasisPoints = (value: string): number => {
  let newAmount = Number.parseFloat(value)
  if (isNaN(newAmount)) {
    newAmount = 0
  }
  return Math.round(newAmount * 100)
}

const PercentageInput = (props: Props) => {
  let {
    id,
    name,
    value,
    placeholder,
    preSlot,
    postSlot,
    onChange: _onChange,
    onBlur,
    onFocus,
    disabled,
  } = props
  const [internalValue, setInternalValue] = useState<string | undefined>(
    value ? (value / 100).toFixed(2) : undefined,
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (_onChange) {
        _onChange(getPercentageBasisPoints(e.target.value))
      }
      setInternalValue(e.target.value)
    },
    [_onChange],
  )

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const regex = /^\d+([\.,]\d{0,2})?$/
    if (!regex.test(value)) {
      e.target.value = Number.parseFloat(value).toFixed(2)
    }
  }

  return (
    <Input
      type="number"
      step={0.01}
      min={0.01}
      max={100}
      id={id}
      name={name}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 text-base placeholder:text-gray-400',
        props.className ?? '',
      )}
      value={internalValue}
      onChange={onChange}
      onInput={onInput}
      placeholder={placeholder ? `${placeholder / 100}` : undefined}
      postSlot={postSlot ? postSlot : <Percent className="h-4 w-4" />}
      preSlot={preSlot}
      onBlur={onBlur}
      onFocus={onFocus}
      onWheel={(e) => {
        ;(e.target as HTMLInputElement).blur()
      }}
      disabled={disabled}
    />
  )
}

export default PercentageInput
