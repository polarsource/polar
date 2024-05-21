import { Organization } from '@polar-sh/sdk'
import lunr from 'lunr'
import { useRouter } from 'next/navigation'
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import lunrSearchIndex from '../index/searchIndex.json'
import lunrSearchMetadata from '../index/searchMetadata.json'
import { Command } from './commands'
import { SCOPES, Scope, ScopeKey, ScopeType } from './scopes'
import { useScopes } from './useScopes'

console.log(lunrSearchMetadata)

const searchMetadataLookup = new Map([
  ...lunrSearchMetadata.openapi.map((m) => [m.id, m]),
  ...lunrSearchMetadata.docs.map((m) => [m.id, m]),
])

export interface CommandContextValue {
  scopes: ReturnType<typeof SCOPES>
  scopeKey: ScopeKey
  scope?: Scope
  scopeKeys: ScopeKey[]
  setScopeKeys: (
    scopeKeys: ((scopeKeys: ScopeKey[]) => ScopeKey[]) | ScopeKey[],
  ) => void
  commands: Command[]
  selectedCommand?: Command
  setSelectedCommand: (command: Command) => void
  input: string
  setInput: (input: string) => void
  hideCommandPalette: () => void
}

const defaultCommandContextValue: CommandContextValue = {
  scopes: [] as any,
  scopeKey: 'global',
  scope: { name: 'global', commands: [], type: ScopeType.Global },
  scopeKeys: [],
  setScopeKeys: () => [],
  commands: [],
  selectedCommand: { name: '', description: '' },
  setSelectedCommand: () => {},
  input: '',
  setInput: () => {},
  hideCommandPalette: () => {},
}

const CommandContext = createContext(defaultCommandContextValue)

interface CommandContextProviderProps {
  organization?: Organization
  hideCommandPalette: () => void
}

export const CommandContextProvider = ({
  children,
  organization,
  hideCommandPalette,
}: PropsWithChildren<CommandContextProviderProps>) => {
  const router = useRouter()
  const [scopeKeys, setScopeKeys] = useState<ScopeKey[]>(['global'])
  const [selectedCommand, setSelectedCommand] = useState<Command>()
  const [input, setInput] = useState('')

  const searchIndex: lunr.Index = useMemo(() => {
    return lunr.Index.load(lunrSearchIndex)
  }, [])

  const scopeKey = useMemo(() => scopeKeys[scopeKeys.length - 1], [scopeKeys])

  const scopes = useScopes(
    {
      setScopeKeys,
      hideCommandPalette,
    },
    organization,
  )

  const scope = useMemo(
    () => scopes.find((scope) => scope.name === scopeKey),
    [scopes, scopeKey],
  )

  // Filter out commands based on input
  const commands = useMemo(() => {
    const searchResults =
      scope?.type === ScopeType.Global && input.length > 0
        ? searchIndex.query((q) =>
            q.term(input, { wildcard: lunr.Query.wildcard.TRAILING }),
          )
        : []

    const searchCommands = searchResults.map((result) => ({
      name: searchMetadataLookup.get(result.ref)?.title ?? '',
      description: 'Go to page',
      action: () => {
        router.push(result.ref)

        hideCommandPalette()
      },
    }))

    const scopeCommands =
      scope?.commands.filter(
        (command) =>
          command.name.toLowerCase().includes(input.toLowerCase()) ||
          command.description.toLowerCase().includes(input.toLowerCase()),
      ) ?? []

    return [...searchCommands, ...scopeCommands]
  }, [scope, input, searchIndex, router, hideCommandPalette])

  useEffect(() => {
    setSelectedCommand(commands[0])
  }, [commands])

  useEffect(() => {
    setInput('')
  }, [scopeKeys])

  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!selectedCommand) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()

        const currentIndex = commands.findIndex(
          (command) => command.name === selectedCommand.name,
        )
        if (currentIndex < commands.length - 1) {
          setSelectedCommand(commands[currentIndex + 1])
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()

        const currentIndex = commands.findIndex(
          (command) => command.name === selectedCommand.name,
        )
        if (currentIndex > 0) {
          setSelectedCommand(commands[currentIndex - 1])
        }
      }

      if (e.key === 'Enter' && selectedCommand.action) {
        e.preventDefault()
        e.stopPropagation()

        selectedCommand.action()
      }

      if (
        e.key === 'Backspace' &&
        input.length === 0 &&
        scope?.type === ScopeType.Isolated
      ) {
        e.preventDefault()
        e.stopPropagation()

        setScopeKeys((prev) => prev.slice(0, -1))
      }
    }

    document.addEventListener('keydown', handleArrowKeys)

    return () => {
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [
    commands,
    selectedCommand,
    hideCommandPalette,
    input,
    scope,
    scopes,
    scopeKey,
    setScopeKeys,
  ])

  return (
    <CommandContext.Provider
      value={{
        scopes,
        scope,
        scopeKeys,
        setScopeKeys,
        scopeKey,
        commands,
        selectedCommand,
        setSelectedCommand,
        input,
        setInput,
        hideCommandPalette,
      }}
    >
      {children}
    </CommandContext.Provider>
  )
}

export const useCommands = () => useContext(CommandContext)
