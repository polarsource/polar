import { cn } from '@polar-sh/ui/lib/utils'
import type * as React from 'react'

export type TextAreaProps = React.ComponentProps<'textarea'>

const TextArea = ({ className, ...props }: TextAreaProps) => {
  return (
    <textarea
      className={cn(
        'ring-offset-background focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'dark:border-polar-700 bg-white shadow-xs dark:bg-polar-800 dark:text-white dark:placeholder:text-polar-500 min-h-[120px] rounded-2xl focus-visible:ring-blue-100 p-4 text-sm border-gray-200 outline-none focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
        className,
      )}
      {...props}
    />
  )
}

TextArea.displayName = 'TextArea'

export { TextArea }
