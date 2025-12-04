import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface EventCardBaseProps extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> {
  children: React.ReactNode
  loading?: boolean
}

export const EventCardBase = ({
  children,
  className,
  loading,
  ...props
}: EventCardBaseProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:group-hover:bg-polar-800 mx-1 mb-1 flex flex-row gap-4 rounded-md bg-gray-50 px-2 py-1 font-mono text-xs select-none group-hover:bg-gray-100',
        'transition-colors duration-150',
        loading ? 'animate-pulse' : '',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="w-full px-2 py-2">Loading...</span>
      ) : (
        children
      )}
    </div>
  )
}
