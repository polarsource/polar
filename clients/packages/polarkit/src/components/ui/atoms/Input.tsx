import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Input as ShadInput } from '../input'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ preSlot, postSlot, className, ...props }: InputProps, ref) => {
    return (
      <div className="dark:bg-polar-800 relative flex flex-1 flex-row rounded-full bg-white">
        <ShadInput
          className={twMerge(
            'dark:border-polar-600 dark:placeholder:text-polar-500 dark:text-polar-50 rounded-full border-gray-200 bg-transparent px-4 py-2 text-sm text-gray-950 shadow-sm outline-none placeholder:text-gray-400 focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
            preSlot && 'pl-10',
            postSlot && 'pr-10',
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
  },
)

Input.displayName = 'Input'

export default Input
