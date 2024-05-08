import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Command } from './commands'
import { SCOPES, Scope, ScopeType } from './scopes'

export interface CommandContextValue {
  scopes: Scope[]
  scope: Scope
  setScope: (scope: Scope) => void
  commands: Command[]
  selectedCommand: Command
  setSelectedCommand: (command: Command) => void
  input: string
  setInput: (input: string) => void
  hideCommandPalette: () => void
}

const defaultCommandContextValue: CommandContextValue = {
  scopes: [],
  scope: { name: 'global', commands: [], type: ScopeType.Global },
  setScope: (scope: Scope) => {},
  commands: [],
  selectedCommand: { name: '', description: '' },
  setSelectedCommand: (command: Command) => {},
  input: '',
  setInput: (input: string) => {},
  hideCommandPalette: () => {},
}

const CommandContext = createContext(defaultCommandContextValue)

interface CommandContextProviderProps {
  organization: Organization
  hideCommandPalette: () => void
}

export const CommandContextProvider = ({
  children,
  organization,
  hideCommandPalette,
}: PropsWithChildren<CommandContextProviderProps>) => {
  const router = useRouter()

  const scopes = useMemo(() => {
    return SCOPES({
      router,
      organization,
      hideCommandPalette,
    })
  }, [router, organization, hideCommandPalette])

  const [scope, setScope] = useState<Scope>(
    scopes.find((scope) => scope.type === ScopeType.Global)!,
  )
  const commands = useMemo(() => scope.commands, [scope])
  const [selectedCommand, setSelectedCommand] = useState<Command>(commands[0])
  const [input, setInput] = useState('')

  useEffect(() => {
    setSelectedCommand(commands[0])
  }, [commands])

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
        scope.type === ScopeType.Isolated
      ) {
        e.preventDefault()
        e.stopPropagation()

        console.log(scopes.find((scope) => scope.type === ScopeType.Global)!)

        setScope(scopes.find((scope) => scope.type === ScopeType.Global)!)
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
    setScope,
  ])

  return (
    <CommandContext.Provider
      value={{
        scopes,
        scope,
        setScope,
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
