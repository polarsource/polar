import React, { type HTMLButtonElement } from 'react'
import { classNames } from '../../utils/dom'

const PrimaryButton = (props: {
  children: React.ReactNode
  disabled: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) => {
  const disabled = props.disabled ? props.disabled : false
  const classes = classNames(
    disabled ? 'bg-gray-100 text-gray-400' : 'bg-purple-500 text-white',
    'm-auto w-full rounded-lg p-2 text-center text-sm font-medium',
  )

  return (
    <>
      <button className={classes} onClick={props.onClick} disabled={disabled}>
        {props.children}
      </button>
    </>
  )
}
export default PrimaryButton
