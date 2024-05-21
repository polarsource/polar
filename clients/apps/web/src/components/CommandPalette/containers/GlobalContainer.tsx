import { CommandItem } from '../CommandItem'
import { useCommands } from '../commands/useCommands'

export const GlobalContainer = () => {
  const { commands, selectedCommand, setSelectedCommand } = useCommands()

  return (
    <div className="flex h-[360px] flex-grow flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-1 overflow-y-scroll p-4">
        {commands.map((command, index) => {
          return (
            <CommandItem
              key={`${command.name}-${index}`}
              command={command.name}
              description={command.description}
              onClick={() => {
                setSelectedCommand(command)

                command.action?.()
              }}
              active={selectedCommand === command}
            />
          )
        })}
      </div>
    </div>
  )
}
