import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CustomerStatBoxProps {
  title: string
  className?: string
  valueClassName?: string
  size?: 'sm' | 'lg'
}

export const CustomerStatBox = ({
  title,
  children,
  className,
  valueClassName,
  size = 'sm',
}: PropsWithChildren<CustomerStatBoxProps>) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex flex-1 flex-col gap-2 bg-gray-50',
        className,
        size === 'lg'
          ? 'rounded-2xl px-5 py-4'
          : 'rounded-lg px-4 py-3 text-sm',
      )}
    >
      <span className="dark:text-polar-500 text-gray-500">{title}</span>
      <span
        className={twMerge(
          'font-mono',
          valueClassName,
          size === 'lg' ? 'text-xl' : '',
        )}
      >
        {children}
      </span>
    </div>
  )
}
