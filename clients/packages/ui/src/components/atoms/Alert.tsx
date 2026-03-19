import { useMemo } from 'react'

interface AlertProps {
  color: 'blue' | 'gray' | 'red' | 'green' | 'yellow'
}

const Alert: React.FC<React.PropsWithChildren<AlertProps>> = ({
  children,
  color,
}) => {
  const colorClasses = useMemo(() => {
    switch (color) {
      case 'blue':
        return 'bg-indigo-100 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-500'
      case 'gray':
        return 'bg-gray-100 text-gray-500 dark:bg-polar-800 dark:text-polar-500'
      case 'red':
        return 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-500'
      case 'green':
        return 'bg-green-100 text-green-500 dark:bg-green-950 dark:text-green-500'
      case 'yellow':
        return 'bg-amber-100 text-amber-500 dark:bg-amber-950 dark:text-amber-500'
    }
  }, [color])

  return <div className={`rounded-lg p-2 ${colorClasses}`}>{children}</div>
}

export default Alert
