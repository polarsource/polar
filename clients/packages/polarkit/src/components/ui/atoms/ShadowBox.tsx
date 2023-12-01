import { twMerge } from 'tailwind-merge'

const ShadowBox = (props: {
  className?: string
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div
    className={twMerge(
      'dark:bg-polar-900 dark:ring-polar-700 w-full rounded-xl bg-white p-5 shadow dark:ring-1',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox
