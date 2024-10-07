import { SearchOutlined } from '@mui/icons-material'
import { twMerge } from 'tailwind-merge'
import { CommandPaletteTriggerKey } from './commands/trigger'

export interface CommandPaletteTriggerProps {
  className?: string
  shortcutClassName?: string
  title?: string
  onClick: () => void
}

export const CommandPaletteTrigger = ({
  title = 'Search',
  className,
  onClick,
}: CommandPaletteTriggerProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-800 flex min-w-52 cursor-pointer flex-row items-center justify-between gap-x-4 rounded-xl border border-gray-100 bg-gray-100 py-2 pl-4 pr-2 shadow-none',
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
          'dark:border-polar-600 cursor-default rounded-md bg-white px-2 py-1 text-xs tracking-wide dark:border dark:bg-transparent',
        )}
      >
        <CommandPaletteTriggerKey />
      </div>
    </div>
  )
}
