import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ListProps extends PropsWithChildren {
  className?: string
}

export const List = ({ children, className }: ListProps) => {
  return (
    <div
      className={twMerge(
        'dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface ListItemProps extends PropsWithChildren {
  className?: string
  children: React.ReactNode
  selected?: boolean
  onSelect?: () => void
}

export const ListItem = ({
  className,
  children,
  selected,
  onSelect,
}: ListItemProps) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between bg-white px-6 py-4 dark:bg-transparent',
        selected
          ? 'dark:bg-polar-800 bg-blue-50'
          : 'dark:hover:bg-polar-900 hover:bg-gray-50',
        onSelect && 'cursor-pointer',
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </div>
  )
}
