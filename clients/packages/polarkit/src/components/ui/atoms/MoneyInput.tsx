import { AttachMoneyOutlined } from '@mui/icons-material'
import { ChangeEvent, FocusEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { getCentsInDollarString } from '../../../lib/money'
import Input from './Input'

interface Props {
  id: string
  name: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder: number
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  value?: number
  className?: string
  onAmountChangeInCents?: (cents: number) => void
  postSlot?: React.ReactNode
}

const getCents = (event: ChangeEvent<HTMLInputElement>) => {
  let newAmount = parseInt(event.target.value)
  if (isNaN(newAmount)) {
    newAmount = 0
  }
  const amountInCents = newAmount * 100
  return amountInCents
}

const MoneyInput = (props: Props) => {
  let { id, name } = props

  let other: {
    value?: string
    onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
    onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  } = {}
  if (props.value && props.value > 0) {
    other.value = getCentsInDollarString(props.value)
  } else {
    other.value = ''
  }
  other.onBlur = props.onBlur
  other.onFocus = props.onFocus

  const onChanged = (e: ChangeEvent<HTMLInputElement>) => {
    if (props.onChange) {
      props.onChange(e)
    }

    if (props.onAmountChangeInCents) {
      props.onAmountChangeInCents(getCents(e))
    }
  }

  return (
    <Input
      type="text"
      id={id}
      name={name}
      className={twMerge(
        'dark:placeholder:text-polar-500 block w-full px-4 pl-8 text-base placeholder:text-gray-400',
        props.className ?? '',
      )}
      onChange={onChanged}
      placeholder={getCentsInDollarString(props.placeholder)}
      preSlot={<AttachMoneyOutlined className="text-lg" fontSize="inherit" />}
      postSlot={props.postSlot}
      {...other}
    />
  )
}

export default MoneyInput
