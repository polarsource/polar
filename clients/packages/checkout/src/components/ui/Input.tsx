import { cn } from '@polar-sh/ui/lib/utils'
import type * as React from 'react'

export type InputProps = React.ComponentProps<'input'> & {
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
}

const Input = ({
  preSlot,
  postSlot,
  className,
  type,
  ...props
}: InputProps) => {
  return (
    <div className="relative flex flex-1 flex-row rounded-full">
      <input
        type={type}
        className={cn(
          'ring-offset-background file:text-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'dark:placeholder:text-polar-500 dark:border-polar-700 dark:bg-polar-800 h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-950 shadow-xs outline-none placeholder:text-gray-400 focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 md:text-sm dark:text-white dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
          preSlot ? 'pl-10' : '',
          postSlot ? 'pr-10' : '',
          className,
        )}
        {...props}
      />
      {preSlot && (
        <div className="dark:text-polar-400 pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-500">
          {preSlot}
        </div>
      )}
      {postSlot && (
        <div className="dark:text-polar-400 pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-4 text-gray-500">
          {postSlot}
        </div>
      )}
    </div>
  )
}

Input.displayName = 'Input'

export { Input }
