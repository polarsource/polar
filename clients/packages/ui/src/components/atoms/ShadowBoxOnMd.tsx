import { DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

const ShadowBoxOnMd = ({
  className,
  children,
  ...props
}: DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
  <div
    className={twMerge(
      'md:dark:bg-polar-900 dark:border-polar-700 w-full md:rounded-xl md:border md:border-transparent md:bg-gray-50 md:p-8 lg:rounded-4xl',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export default ShadowBoxOnMd
