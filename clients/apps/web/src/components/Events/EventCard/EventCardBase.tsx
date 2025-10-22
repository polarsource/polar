import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface EventCardBaseProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  children: React.ReactNode
}

export const EventCardBase = ({
  children,
  className,
  ...props
}: EventCardBaseProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:group-hover:bg-polar-800 mx-1 mb-1 flex flex-row gap-4 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs select-none group-hover:bg-gray-200',
        'transition-colors duration-150',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
