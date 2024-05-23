import { SearchOutlined } from '@mui/icons-material'
import { twMerge } from 'tailwind-merge'

export interface CommandPaletteTriggerProps {
  className?: string
  shortcutClassName?: string
  title?: string
  onClick: () => void
}

export const CommandPaletteTrigger = ({
  title = 'Search',
  className,
  shortcutClassName,
  onClick,
}: CommandPaletteTriggerProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 -mx-3 flex min-w-52 cursor-pointer flex-row items-center justify-between gap-x-4 rounded-xl bg-white py-2 pl-4 pr-2 shadow-sm',
        className,
      )}
      role="button"
      onClick={onClick}
    >
      <div className="flex flex-row items-center gap-x-2">
        <SearchOutlined fontSize="inherit" />
        <span className="dark:text-polar-500 text-sm text-gray-500">
          {title}
        </span>
      </div>
      <div
        className={twMerge(
          'dark:border-polar-600 rounded-md bg-gray-100 px-2 py-1 text-xs tracking-wide dark:border dark:bg-transparent',
          shortcutClassName,
        )}
      >
        <span>⌘K</span>
      </div>
    </div>
  )
}
