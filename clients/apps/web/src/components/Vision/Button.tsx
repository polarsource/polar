import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps {
  className?: string
  variant?: 'primary' | 'icon'
}

export const Button = ({
  children,
  className,
  variant = 'primary',
}: PropsWithChildren<ButtonProps>) => {
  const primaryClassName = 'p-2 text-xs'
  const iconClassName = 'h-4 w-4 text-xxs'

  return (
    <button
      className={twMerge(
        'border-polar-200 hover:bg-polar-200 flex flex-col items-center justify-center border-[0.5px] border-b-2 font-mono leading-none focus-within:bg-white focus-within:text-black focus-within:outline-none hover:text-black',
        variant === 'primary' ? primaryClassName : iconClassName,
        className,
      )}
    >
      {children}
    </button>
  )
}
