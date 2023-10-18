import { classNames } from 'polarkit/utils'

const Pill = ({
  children,
  withIcon,
  color,
}: {
  children: React.ReactNode
  withIcon?: boolean
  color: 'gray' | 'blue' | 'purple'
}) => {
  return (
    <span
      className={classNames(
        'inline-flex items-center space-x-3 whitespace-nowrap rounded-full px-1.5 py-0.5 text-sm text-xs font-medium transition-all duration-200',

        color === 'blue'
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-200'
          : '',
        color === 'gray'
          ? 'dark:bg-polar-700 dark:text-polar-300 bg-gray-100 text-gray-600'
          : '',
        color === 'purple'
          ? 'bg-purple-100 text-purple-600  dark:bg-purple-700 dark:text-purple-300  '
          : '',
      )}
    >
      {children}
    </span>
  )
}

export default Pill
