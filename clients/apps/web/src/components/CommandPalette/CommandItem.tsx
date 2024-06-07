import { PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CommandItemProps {
  command: string
  description: string
  active?: boolean
  onClick: () => void
}

export const CommandItem = ({
  command,
  description,
  active,
  onClick,
  children,
}: PropsWithChildren<CommandItemProps>) => {
  const ref = useRef<HTMLDivElement>(null)

  const handleSelect = useCallback(() => {
    ref.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
  }, [])

  useEffect(() => {
    if (active) {
      handleSelect()
    }
  }, [active, handleSelect])

  return (
    <div
      ref={ref}
      className={twMerge(
        'dark:hover:bg-polar-900 group flex scroll-m-4 flex-col gap-y-1 rounded-2xl border border-transparent px-4 py-3 text-sm hover:cursor-pointer hover:bg-white dark:border-transparent',
        active
          ? 'dark:bg-polar-800 dark:border-polar-700 bg-white shadow-sm'
          : '',
      )}
      onClick={onClick}
    >
      <div className="flex flex-row items-center justify-between gap-x-3">
        <h3
          className={twMerge(
            'dark:group-hover:text-polar-50 font-medium capitalize transition-colors group-hover:text-gray-950',
            active
              ? 'text-gray-950 dark:text-white'
              : 'dark:text-white0 text-gray-500',
          )}
        >
          {command}
        </h3>
        {children}
      </div>
      <span
        className={twMerge(
          'dark:group-hover:text-polar-500 truncate text-sm transition-colors group-hover:text-gray-500',
          active
            ? 'dark:text-white0 text-gray-500'
            : 'dark:text-polar-600 text-gray-400',
        )}
      >
        {description}
      </span>
    </div>
  )
}
