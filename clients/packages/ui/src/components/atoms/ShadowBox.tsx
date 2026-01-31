import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

interface ShadowBoxProps {
  className?: string
  variant?: 'default' | 'glass'
  ref?: React.RefObject<HTMLDivElement>
}

const ShadowBox = ({
  ref,
  variant = 'default',
  ...props
}: PropsWithChildren<ShadowBoxProps>) => (
  <div
    ref={ref}
    className={twMerge(
      'w-full rounded-xl p-8 lg:rounded-4xl',
      variant === 'default' && 'dark:bg-polar-900 dark:border-polar-700 border border-transparent bg-gray-50',
      variant === 'glass' && [
        'bg-gray-100/80 border border-gray-200/50 backdrop-blur-md',
        'dark:bg-polar-800/60 dark:border-polar-700/40',
      ],
      props.className,
    )}
  >
    {props.children}
  </div>
)

ShadowBox.displayName = 'ShadowBox'

export default ShadowBox

export { ShadowBoxOnMd }
