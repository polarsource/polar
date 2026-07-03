'use client'

import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export type SidebarSwitcherOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

export function SidebarSwitcher<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SidebarSwitcherOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="tablist"
      className="dark:bg-polar-900 dark:border-polar-800 flex w-full items-center gap-1 rounded-full border border-transparent bg-gray-50 p-1"
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={twMerge(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'dark:bg-polar-800 bg-white text-black dark:text-white shadow-lg'
                : 'dark:text-polar-500 text-gray-500 hover:text-black dark:hover:text-white',
            )}
          >
            {option.icon && (
              <span className="flex items-center text-sm">{option.icon}</span>
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
