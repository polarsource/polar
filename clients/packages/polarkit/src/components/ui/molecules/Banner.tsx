import clsx from 'clsx'
import React from 'react'

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
      className={clsx(
        'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
        color === 'default'
          ? 'dark:bg-polar-800 dark:ring-polar-700 bg-white shadow dark:ring-1'
          : '',
        color === 'muted'
          ? 'bg-gray-75 dark:bg-polar-800 dark:border-polar-700 border text-gray-500'
          : '',
        color === 'red'
          ? 'border bg-red-100 text-red-600  dark:border-red-800 dark:bg-red-900 dark:text-red-600'
          : '',
        color === 'green'
          ? 'border bg-green-100 text-green-600  dark:border-green-800 dark:bg-green-900 dark:text-green-600'
          : '',
        color === 'blue'
          ? 'border bg-blue-100 text-blue-600  dark:border-blue-800 dark:bg-blue-900 dark:text-blue-600'
          : '',
      )}
    >
      <div className="flex flex-1 items-center gap-2">{children}</div>
      {right && <div>{right}</div>}
    </div>
  )
}

export default Banner
