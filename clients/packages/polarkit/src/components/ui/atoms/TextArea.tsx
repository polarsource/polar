import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Textarea, TextareaProps } from '../textarea'

export interface TextAreaProps extends TextareaProps {
  resizable?: boolean | undefined
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ resizable = true, className, ...props }, ref) => {
    const classNames = twMerge(
      'dark:border-polar-600 dark:placeholder:text-polar-500 min-h-[120px] rounded-lg border-gray-200 bg-white dark:bg-polar-800 focus-visible:ring-blue-100 p-3 text-sm shadow-sm outline-none focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
      resizable ? '' : 'resize-none',
      className,
    )

    return <Textarea ref={ref} className={classNames} {...props} />
  },
)

export default TextArea
