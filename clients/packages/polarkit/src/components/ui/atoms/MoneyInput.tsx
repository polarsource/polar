import { getCentsInDollarString } from 'polarkit/money'
import { ChangeEvent, FocusEvent } from 'react'
import { twMerge } from 'tailwind-merge'

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
    <>
      <div className={twMerge('relative')}>
        <input
          type="text"
          id={id}
          name={name}
          className={twMerge(
            'dark:border-polar-600 dark:placeholder:text-polar-600 block w-full rounded-lg border-gray-200 bg-transparent px-4 py-2 pl-7 pr-16 text-lg placeholder-gray-400 shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
            props.className ?? '',
          )}
          onChange={onChanged}
          placeholder={getCentsInDollarString(props.placeholder)}
          {...other}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-lg">
          <span className="dark:text-polar-400 text-gray-500">$</span>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm">
          <span className="dark:text-polar-400 text-gray-500">USD</span>
        </div>
      </div>
    </>
  )
}

export default MoneyInput
