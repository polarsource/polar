import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ListProps extends PropsWithChildren {
  className?: string
  size?: 'small' | 'default'
}

export const List = ({ children, className, size = 'default' }: ListProps) => {
  return children ? (
    <div
      className={twMerge(
        'dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-100 overflow-hidden border border-gray-100',
        size === 'default' ? 'rounded-3xl' : 'rounded-2xl',
        className,
      )}
    >
      {children}
    </div>
  ) : null
}

export interface ListItemProps extends PropsWithChildren {
  className?: string
  children: React.ReactNode
  selected?: boolean
  onSelect?: () => void
  size?: 'small' | 'default'
}

export const ListItem = ({
  className,
  children,
  selected,
  onSelect,
  size = 'default',
}: ListItemProps) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between',
        selected
          ? 'dark:bg-polar-800 bg-gray-75'
          : 'dark:hover:bg-polar-900 hover:bg-gray-50',
        onSelect && 'cursor-pointer',
        size === 'default' ? 'px-6 py-4' : 'px-4 py-2',
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </div>
  )
}
