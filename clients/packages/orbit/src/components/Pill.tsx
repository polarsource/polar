import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export type PillColor = 'gray' | 'blue' | 'purple' | 'yellow' | 'red' | 'green'

export interface PillProps {
  children: ReactNode
  color: PillColor
  className?: string
}

export const Pill = ({ children, color, className }: PillProps) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center space-x-1 rounded-full px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all duration-200',

        color === 'blue'
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200'
          : '',
        color === 'gray'
          ? 'dark:bg-polar-700 dark:text-polar-300 bg-gray-100 text-gray-600'
          : '',
        color === 'purple'
          ? 'bg-purple-100 text-purple-600 dark:bg-purple-700 dark:text-purple-300'
          : '',
        color === 'yellow'
          ? 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950'
          : '',
        color === 'red'
          ? 'bg-red-100 text-red-600 dark:bg-red-700 dark:text-red-300'
          : '',
        color === 'green'
          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300'
          : '',
        className,
      )}
    >
      {children}
    </span>
  )
}
