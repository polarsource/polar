import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: {
  className?: string
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div
    className={twMerge(
      'dark:bg-polar-900 lg:rounded-4xl w-full rounded-xl border border-gray-100 bg-transparent p-8 dark:border-transparent',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
