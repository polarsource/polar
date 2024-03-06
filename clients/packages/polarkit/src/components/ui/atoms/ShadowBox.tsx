import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: {
  className?: string
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div
    className={twMerge(
      'dark:bg-polar-900 dark:ring-polar-800 ring-gray-75 w-full rounded-xl bg-white p-8 shadow-sm ring-1 dark:ring-1 lg:rounded-3xl',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
