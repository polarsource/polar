import { twMerge } from 'tailwind-merge'

export interface DetailRowProps {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
  valueClassName?: string
  labelClassName?: string
}

export const DetailRow = ({
  label,
  labelClassName = '',
  value,
  valueClassName = '',
  action,
}: DetailRowProps) => {
  return (
    <div className="flex flex-col text-sm md:flex-row md:items-baseline md:justify-between md:gap-4">
      <h3
        className={twMerge(
          'dark:text-polar-500 flex-1 text-gray-500',
          labelClassName,
        )}
      >
        {label}
      </h3>
      <span
        className={twMerge(
          'dark:md:hover:bg-polar-800 group flex flex-1 flex-row flex-nowrap items-center justify-between gap-x-2 rounded-md transition-colors duration-75 md:px-2.5 md:py-1 hover:md:bg-gray-100',
          value ? '' : 'dark:text-polar-500 text-gray-500',
          valueClassName,
        )}
      >
        {value ?? '—'}
        <span className="opacity-0 group-hover:opacity-100">{action}</span>
      </span>
    </div>
  )
}
