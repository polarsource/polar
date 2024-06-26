import { DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

const ShadowBoxOnMd = ({
  className,
  children,
  ...props
}: DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
  <div
    className={twMerge(
      'md:dark:ring-polar-700 w-full md:rounded-xl md:bg-transparent md:p-8 md:shadow-sm md:ring-1 md:ring-gray-100 lg:rounded-3xl md:dark:bg-transparent md:dark:ring-1',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export default ShadowBoxOnMd
