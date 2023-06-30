import { classNames } from 'polarkit/utils'
import React from 'react'

type Color = 'default' | 'muted'

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
      className={classNames(
        'flex items-center justify-between rounded-lg px-3 py-2',
        color === 'default'
          ? 'bg-white shadow dark:bg-gray-700 dark:ring-1 dark:ring-gray-600'
          : '',
        color === 'muted'
          ? 'bg-gray-75 border dark:border-gray-800  dark:bg-gray-900'
          : '',
      )}
    >
      <div className="flex items-center gap-2">{children}</div>
      {right && <div>{right}</div>}
    </div>
  )
}

export default Banner
