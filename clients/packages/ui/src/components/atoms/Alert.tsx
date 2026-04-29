import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface AlertProps {
  color: 'blue' | 'gray' | 'red' | 'green' | 'yellow'
  className?: string
}

const Alert: React.FC<React.PropsWithChildren<AlertProps>> = ({
  children,
  color,
  className,
}) => {
  const colorClasses = useMemo(() => {
    switch (color) {
      case 'blue':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-500'
      case 'gray':
        return 'bg-gray-100 text-gray-700 dark:bg-polar-800 dark:text-polar-500'
      case 'red':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-500'
      case 'green':
        return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-500'
      case 'yellow':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-500'
    }
  }, [color])

  return (
    <div className={twMerge('rounded-lg p-2', colorClasses, className)}>
      {children}
    </div>
  )
}

export default Alert
