import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CustomerStatBoxProps {
  title: string
  className?: string
  valueClassName?: string
  size?: 'sm' | 'lg'
  variant?: 'default' | 'glass'
}

export const CustomerStatBox = ({
  title,
  children,
  className,
  valueClassName,
  size = 'sm',
  variant = 'glass',
}: PropsWithChildren<CustomerStatBoxProps>) => {
  return (
    <div
      className={twMerge(
        'flex flex-1 flex-col gap-2',
        variant === 'default' && 'dark:bg-polar-800 dark:border-polar-700 bg-gray-50',
        variant === 'glass' && [
          'bg-gray-100/80 border border-gray-200/50 backdrop-blur-md',
          'dark:bg-polar-800/60 dark:border-polar-700/40',
        ],
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
