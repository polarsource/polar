'use client'

import { ArrowBackOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { ScopeType } from './commands/scopes'
import { CommandContextProvider, useCommands } from './commands/useCommands'
import { APIContainer } from './containers/APIContainer'
import { GlobalContainer } from './containers/GlobalContainer'

export interface CommandPaletteProps {
  organization: Organization
  hide: () => void
}

export const CommandPalette = ({ organization, hide }: CommandPaletteProps) => {
  return (
    <CommandContextProvider
      organization={organization}
      hideCommandPalette={hide}
    >
      <div className="dark:bg-polar-900 dark:border-polar-800 flex w-full flex-grow flex-col overflow-hidden rounded-3xl border bg-gray-100">
        <CommandPaletteInput />
        <CommandPaletteContainer />
      </div>
    </CommandContextProvider>
  )
}

const CommandPaletteInput = () => {
  const { scope, input, setInput, setScopeKeys } = useCommands()

  const renderBackButton = useMemo(
    () => scope?.type === ScopeType.Isolated,
    [scope],
  )

  const handleBack = useCallback(() => {
    setScopeKeys((scopeKeys) => scopeKeys.slice(0, -1))
  }, [setScopeKeys])

  return (
    <div className="dark:bg-polar-950 dark:border-polar-800 flex flex-row gap-x-4 border-b border-gray-200 bg-white px-8 py-6">
      {renderBackButton && (
        <div
          className="dark:bg-polar-700 dark:hover:bg-polar-600 flex aspect-square h-full flex-shrink-0 flex-col items-center justify-center rounded-lg bg-gray-200 transition-colors hover:cursor-pointer hover:bg-gray-100"
          onClick={handleBack}
        >
          <ArrowBackOutlined fontSize="inherit" />
        </div>
      )}
      <input
        className="dark:text-polar-50 dark:placeholder:text-polar-500 w-full border-none bg-transparent p-0 text-xl text-gray-950 placeholder:text-gray-400 focus:border-none focus:outline-none focus:ring-0"
        placeholder="Enter Command..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoFocus
      />
    </div>
  )
}

const CommandPaletteContainer = () => {
  const { scopes, scope, setScopeKeys } = useCommands()
  const pathname = usePathname()

  useEffect(() => {
    const scopeCandidate = scopes.find((s) =>
      pathname.includes(s.name.replace('api:', '')),
    )

    if (scopeCandidate) {
      setScopeKeys(['global', scopeCandidate.name])
    }
  }, [])

  const container = useMemo(() => {
    switch (scope?.name.split(':')[0]) {
      case 'api':
        return <APIContainer />
      default:
        return <GlobalContainer />
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
        'dark:hover:bg-polar-800 group flex scroll-m-4 flex-col gap-y-1 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors hover:cursor-pointer hover:bg-white dark:border-transparent',
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
              ? 'dark:text-polar-50 text-gray-950'
              : 'dark:text-polar-500 text-gray-500',
          )}
        >
          {command}
        </h3>
        {children}
      </div>
      <span
        className={twMerge(
          'dark:group-hover:text-polar-500 truncate font-mono text-xs transition-colors group-hover:text-gray-500',
          active
            ? 'dark:text-polar-500 text-gray-500'
            : 'dark:text-polar-600 text-gray-400',
        )}
      >
        {description}
      </span>
    </div>
  )
}
