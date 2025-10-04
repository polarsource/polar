import { Textarea } from '@/components/ui/textarea'
import { twMerge } from 'tailwind-merge'

export interface TextAreaProps extends React.ComponentProps<'textarea'> {
  resizable?: boolean | undefined
}

const TextArea = ({
  ref,
  resizable = true,
  className,
  ...props
}: TextAreaProps) => {
  const classNames = twMerge(
    'dark:border-polar-700 bg-white shadow-xs dark:bg-polar-800 dark:text-white dark:placeholder:text-polar-500 min-h-[120px] rounded-2xl focus-visible:ring-blue-100 p-4 text-sm border-gray-200 outline-none focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
    resizable ? '' : 'resize-none',
    className,
  )

  return <Textarea ref={ref} className={classNames} {...props} />
}

TextArea.displayName = 'TextArea'

export default TextArea
