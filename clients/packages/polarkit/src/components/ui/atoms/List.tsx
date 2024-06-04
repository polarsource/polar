import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const List = ({ children }: PropsWithChildren) => {
  return (
    <div className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100">
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
        'dark:hover:bg-polar-900 flex flex-row items-center justify-between bg-white px-6 py-4 hover:bg-gray-50 dark:bg-transparent',
        selected && 'dark:bg-polar-800 bg-blue-50',
        onSelect && 'cursor-pointer',
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </div>
  )
}
