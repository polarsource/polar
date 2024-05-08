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

const defaultScope = SCOPES.find((scope) => scope.type === ScopeType.Global)

if (!defaultScope) {
  throw new Error('No global scope found')
}

export interface CommandContextValue {
  scope: Scope
  setScope: (scope: Scope) => void
  commands: Command[]
  selectedCommand: Command
  setSelectedCommand: (command: Command) => void
}

const defaultCommandContextValue: CommandContextValue = {
  scope: defaultScope,
  setScope: (scope: Scope) => {},
  commands: [],
  selectedCommand: defaultScope.commands[0],
  setSelectedCommand: (command: Command) => {},
}

const CommandContext = createContext(defaultCommandContextValue)

export const CommandContextProvider = ({ children }: PropsWithChildren) => {
  const [scope, setScope] = useState<Scope>(defaultScope)
  const commands = useMemo(() => scope.commands, [scope])
  const [selectedCommand, setSelectedCommand] = useState<Command>(commands[0])

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
    }

    document.addEventListener('keydown', handleArrowKeys)

    return () => {
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [commands, selectedCommand])

  return (
    <CommandContext.Provider
      value={{ scope, setScope, commands, selectedCommand, setSelectedCommand }}
    >
      {children}
    </CommandContext.Provider>
  )
}

export const useCommands = () => useContext(CommandContext)
