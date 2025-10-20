import { Input as ShadInput } from '@/components/ui/input'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export type InputProps = ComponentProps<typeof ShadInput> & {
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
}

const Input = ({ ref, preSlot, postSlot, className, ...props }: InputProps) => {
  return (
    <div className="relative flex flex-1 flex-row rounded-full">
      <ShadInput
        className={twMerge(
          'dark:placeholder:text-polar-500 dark:border-polar-700 dark:bg-polar-800 h-10 rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-950 shadow-xs outline-none placeholder:text-gray-400 focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 md:text-sm dark:text-white dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
          preSlot ? 'pl-10' : '',
          postSlot ? 'pr-10' : '',
          className,
        )}
        ref={ref}
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

export default Input
