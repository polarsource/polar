import { DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

const ShadowBoxOnMd = ({
  className,
  children,
  ...props
}: DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
  <div
    className={twMerge(
      'md:dark:bg-polar-900 lg:rounded-4xl w-full md:rounded-xl md:border md:border-gray-100 md:bg-transparent md:p-8 dark:md:border-transparent',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export default ShadowBoxOnMd
