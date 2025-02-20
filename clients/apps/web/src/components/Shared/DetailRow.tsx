import { twMerge } from 'tailwind-merge'

export interface DetailRowProps {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
  valueClassName?: string
}

export const DetailRow = ({
  label,
  value,
  valueClassName = '',
  action,
}: DetailRowProps) => {
  return (
    <div className="flex flex-row items-baseline justify-between gap-x-4 text-sm">
      <h3 className="dark:text-polar-500 flex-1 text-gray-500">{label}</h3>
      <span
        className={twMerge(
          'dark:hover:bg-polar-800 group flex flex-1 flex-row flex-nowrap items-center justify-between gap-x-2 rounded-md px-2.5 py-1 transition-colors duration-75 hover:bg-gray-100',
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
