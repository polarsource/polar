'use client'

import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { SCOPES, ScopeType } from './commands/scopes'
import { CommandContextProvider, useCommands } from './commands/useCommands'
import { APIContainer } from './containers/APIContainer'

export interface CommandPaletteProps {}

export const CommandPalette = ({}: CommandPaletteProps) => {
  const path = usePathname()
  const subPage = path.split('/')[3]
  const defaultInputValue = `API: ${subPage.at(0)?.toUpperCase() + subPage.slice(1)}`

  return (
    <CommandContextProvider>
      <div className="dark:bg-polar-900 dark:border-polar-800 flex w-full flex-grow flex-col overflow-hidden rounded-3xl border bg-gray-100">
        <div className="dark:bg-polar-950 dark:border-polar-800 flex flex-row border-b border-gray-200 bg-white px-8 py-6">
          <input
            className="dark:text-polar-50 dark:placeholder:text-polar-500 w-full border-none bg-transparent p-0 text-xl text-gray-950 placeholder:text-gray-400 focus:border-none focus:outline-none focus:ring-0"
            placeholder="Enter Command..."
            defaultValue={defaultInputValue}
            autoFocus
          />
        </div>
        <CommandPaletteContainer />
      </div>
    </CommandContextProvider>
  )
}

const CommandPaletteContainer = () => {
  const { scope, setScope } = useCommands()
  const pathname = usePathname()

  useEffect(() => {
    const scopeCandidate = SCOPES.find((s) =>
      pathname.includes(s.name.replace('api:', '')),
    )

    if (scopeCandidate) {
      setScope(scopeCandidate)
    } else {
      setScope(SCOPES.find((scope) => scope.type === ScopeType.Global)!)
    }
  }, [pathname, scope])

  const container = useMemo(() => {
    switch (scope.name.split(':')[0]) {
      case 'api':
        return <APIContainer />
    }
  }, [scope])

  return container
}

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
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
        'dark:hover:bg-polar-800 flex scroll-m-4 flex-col gap-y-1 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors hover:cursor-pointer hover:bg-white dark:border-transparent',
        active
          ? 'dark:bg-polar-800 dark:border-polar-700 bg-white shadow-sm'
          : '',
      )}
      onClick={onClick}
    >
      <div className="flex flex-row items-center justify-between gap-x-3">
        <h3 className="dark:text-polar-50 font-medium capitalize text-gray-950">
          {command}
        </h3>
        {children}
      </div>
      <span className="dark:text-polar-500 truncate font-mono text-xs text-gray-500">
        {description}
      </span>
    </div>
  )
}
