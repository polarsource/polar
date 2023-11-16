import { twMerge } from 'tailwind-merge'

const TopbarPill = ({
  children,
  withIcon,
  color,
}: {
  children: React.ReactElement
  withIcon?: boolean
  color: 'gray' | 'blue'
}) => {
  const padding = withIcon ? 'pr-1.5' : 'pr-3'

  return (
    <div
      className={twMerge(
        'inline-flex items-center space-x-3 whitespace-nowrap rounded-full border py-1 pl-3 text-sm font-medium transition-all duration-200',
        padding,
        color === 'blue'
          ? ' border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200 dark:hover:border-blue-700 dark:hover:bg-blue-800'
          : '',
        color === 'gray'
          ? ' dark:bg-polar-700 dark:border-polar-600 dark:text-polar-300 dark:hover:bg-polar-800 border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:hover:border-gray-700'
          : '',
      )}
    >
      {children}
    </div>
  )
}

export default TopbarPill
