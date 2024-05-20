import { Organization } from '@polar-sh/sdk'
import lunr from 'lunr'
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import searchIndex from '../index/searchIndex.json'
import { Command } from './commands'
import { SCOPES, Scope, ScopeKey, ScopeType } from './scopes'
import { useScopes } from './useScopes'

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
  setScopeKeys: (
    scopeKeys: ((scopeKeys: ScopeKey[]) => ScopeKey[]) | ScopeKey[],
  ) => [],
  commands: [],
  selectedCommand: { name: '', description: '' },
  setSelectedCommand: (command: Command) => {},
  input: '',
  setInput: (input: string) => {},
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
  const [scopeKeys, setScopeKeys] = useState<ScopeKey[]>(['global'])
  const [selectedCommand, setSelectedCommand] = useState<Command>()
  const [input, setInput] = useState('')

  useMemo(() => {
    const idx = lunr.Index.load(searchIndex)
    console.log(idx.search(input))
  }, [input])

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
  const commands = useMemo(
    () =>
      scope?.commands.filter(
        (command) =>
          command.name.toLowerCase().includes(input.toLowerCase()) ||
          command.description.toLowerCase().includes(input.toLowerCase()),
      ) ?? [],
    [scope, input],
  )

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
