import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Input as ShadInput } from './'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }: InputProps, ref) => {
    return (
      <ShadInput
        className={twMerge(
          'dark:border-polar-600 dark:placeholder:text-polar-500 rounded-lg border-gray-200 bg-transparent px-3 py-2.5 text-sm shadow-sm outline-none focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'

export default Input
