import { forwardRef, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = forwardRef<
  HTMLDivElement,
  PropsWithChildren<{ className?: string }>
>((props, ref) => (
  <div
    ref={ref}
    className={twMerge(
      'dark:bg-polar-900 lg:rounded-4xl dark:border-polar-700 w-full rounded-xl border border-transparent bg-gray-50 p-8',
      props.className,
    )}
  >
    {props.children}
  </div>
))

ShadowBox.displayName = 'ShadowBox'

export default ShadowBox

export { ShadowBoxOnMd }
