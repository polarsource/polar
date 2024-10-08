import React from 'react'
import { twMerge } from 'tailwind-merge'

type Color = 'default' | 'muted' | 'red' | 'green' | 'blue'

const Banner = ({
  children,
  right,
  color,
}: {
  children: React.ReactNode
  right?: React.ReactNode
  color: Color
}) => {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
        color === 'default'
          ? 'dark:bg-polar-800 dark:ring-polar-700 bg-white ring-1 ring-gray-100'
          : '',
        color === 'muted'
          ? 'dark:bg-polar-800 dark:border-polar-700 border bg-gray-100 text-gray-500'
          : '',
        color === 'red'
          ? 'border bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-600'
          : '',
        color === 'green'
          ? 'border bg-green-100 text-green-600 dark:border-green-800 dark:bg-green-900 dark:text-green-200'
          : '',
        color === 'blue'
          ? 'border border-blue-100 bg-blue-50 text-blue-500 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-300'
          : '',
      )}
    >
      <div className="flex flex-1 items-center gap-2">{children}</div>
      {right && <div>{right}</div>}
    </div>
  )
}

export default Banner
