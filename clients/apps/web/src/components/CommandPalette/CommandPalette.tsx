'use client'

import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import posthog from 'posthog-js'
import { useCallback, useEffect, useMemo } from 'react'
import { SyntaxHighlighterProvider } from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { CommandItem } from './CommandItem'
import { APICommand, CommandType } from './commands/commands'
import { ScopeType } from './commands/scopes'
import {
  CommandPaletteContextProvider,
  useCommands,
} from './commands/useCommands'
import { APIContainer } from './containers/APIContainer'
import { GlobalContainer } from './containers/GlobalContainer'

export interface CommandPaletteProps {
  organization?: Organization
  hide: () => void
}

export const CommandPalette = ({ organization, hide }: CommandPaletteProps) => {
  useEffect(() => {
    posthog.capture('Command Palette Invoked', {
      'Page URL': window.location.href,
    })

    return () => {
      posthog.capture('Command Palette Closed', {
        'Page URL': window.location.href,
      })
    }
  }, [])

  return (
    <CommandPaletteContextProvider
      organization={organization}
      hideCommandPalette={hide}
    >
      <SyntaxHighlighterProvider>
        <div className="dark:bg-polar-950 dark:porder-polar-700 rounded-4xl bg-gray-75 flex w-full flex-grow flex-col overflow-hidden dark:border">
          <CommandPaletteInput />
          <CommandPaletteContainer />
        </div>
      </SyntaxHighlighterProvider>
    </CommandPaletteContextProvider>
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
    <div className="dark:bg-polar-950 dark:border-polar-800 flex flex-row gap-x-4 bg-white px-8 py-6 dark:border-b">
      {renderBackButton && (
        <div
          className="dark:bg-polar-700 dark:hover:bg-polar-600 flex aspect-square h-full flex-shrink-0 flex-col items-center justify-center rounded-lg bg-gray-200 transition-colors hover:cursor-pointer hover:bg-gray-100"
          onClick={handleBack}
        >
          <ArrowBackOutlined fontSize="inherit" />
        </div>
      )}
      <input
        className="dark:placeholder:text-polar-500 w-full border-none bg-transparent p-0 text-lg text-gray-950 placeholder:text-gray-400 focus:border-none focus:outline-none focus:ring-0 dark:text-white"
        placeholder="Search for commands, APIs & documentation..."
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

    // Intentioally omitting dependencies to only run on mount
  }, [])

  const container = useMemo(() => {
    switch (scope?.name.split(':')[0]) {
      case 'api':
        return <APINavigator />
      default:
        return <GlobalContainer />
    }
  }, [scope])

  return container
}

const APINavigator = () => {
  const { commands, selectedCommand, setSelectedCommand, hideCommandPalette } =
    useCommands()

  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { org } = useCurrentOrgAndRepoFromURL()

  const apiEndpoint = useMemo(() => {
    return selectedCommand?.type === CommandType.API ? selectedCommand : null
  }, [selectedCommand])

  const apiCommands = useMemo(
    () => commands.filter((c): c is APICommand => c.type === CommandType.API),
    [commands],
  )

  return (
    <div className="grid h-[360px] grid-cols-3">
      <div className="flex h-full flex-shrink-0 flex-col gap-y-1 overflow-y-scroll p-4">
        {apiCommands.map((command) => {
          return (
            <CommandItem
              key={command.id}
              command={command.name}
              description={command.description}
              onClick={() => {
                setSelectedCommand(command)

                command.action?.({
                  params,
                  searchParams,
                  pathname,
                  router,
                  organization: org,
                  hidePalette: hideCommandPalette,
                })
              }}
              active={selectedCommand === command}
            >
              <span className="py-.5 rounded-sm bg-blue-50 px-2 font-mono text-[9px] uppercase text-blue-500 dark:bg-blue-950 dark:text-blue-200">
                {command.method}
              </span>
            </CommandItem>
          )
        })}
      </div>
      <div className="col-span-2 flex h-full w-full flex-row py-4 pr-4">
        {apiEndpoint && (
          <APIContainer
            operation={apiEndpoint.operation}
            method={apiEndpoint.method}
            path={apiEndpoint.endpointPath}
          />
        )}
      </div>
    </div>
  )
}
