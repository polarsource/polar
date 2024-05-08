import { ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { useCallback } from 'react'
import { CommandItem } from '../CommandPalette'
import { useCommands } from '../commands/useCommands'

const triggerClassName = 'py-1'

const buildCurlCommand = (method: string = 'GET', url: string) => {
  return `curl -X ${method} \\
${url} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>"`
}

export interface APIContainerProps {}

export const APIContainer = ({}: APIContainerProps) => {
  const { commands, selectedCommand, setSelectedCommand } = useCommands()

  const copyCodeToClipboard = useCallback(
    (snippet: string) => () => {
      navigator.clipboard.writeText(snippet)
    },
    [],
  )

  return (
    <div className="flex h-[360px] flex-grow flex-row">
      <div className="flex h-full w-72 flex-shrink-0 flex-col gap-y-1 overflow-y-scroll p-4">
        {commands.map((command) => {
          return (
            <CommandItem
              key={command.name}
              command={command.name}
              description={command.description}
              onClick={() => {
                setSelectedCommand(command)

                command.action?.()
              }}
              active={selectedCommand === command}
            >
              <span className="py-.5 rounded-sm bg-blue-50 px-2 font-mono text-[9px] text-blue-500 dark:bg-blue-950 dark:text-blue-200">
                GET
              </span>
            </CommandItem>
          )
        })}
      </div>
      {selectedCommand && (
        <div className="flex h-full w-full flex-col py-4 pr-4">
          <div className="dark:bg-polar-950 flex h-full w-full flex-col rounded-2xl bg-white shadow-sm">
            <Tabs defaultValue="curl">
              <TabsList className="dark:border-polar-800 flex w-full flex-row items-center gap-x-4 rounded-none border-b border-gray-200 px-4 py-3 md:justify-between">
                <div className="flex flex-row items-center">
                  <TabsTrigger
                    className={triggerClassName}
                    value="curl"
                    size="small"
                  >
                    cURL
                  </TabsTrigger>
                  <TabsTrigger
                    className={triggerClassName}
                    value="nodejs"
                    size="small"
                  >
                    NodeJS
                  </TabsTrigger>
                </div>
                <Button
                  className="dark:text-polar-500 text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                  variant="ghost"
                  size="icon"
                >
                  <ContentPasteOutlined className="h-4 w-4" />
                </Button>
              </TabsList>
              <TabsContent value="curl" className="p-2 py-0">
                <pre className="dark:text-polar-50 select-all p-4 font-mono text-xs leading-normal text-gray-900">
                  {}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}
