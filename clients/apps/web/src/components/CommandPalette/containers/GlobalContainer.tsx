import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import { CommandItem } from '../CommandItem'
import { CommandType } from '../commands/commands'
import { useCommands } from '../commands/useCommands'

export const GlobalContainer = () => {
  const { commands, selectedCommand, setSelectedCommand, hideCommandPalette } =
    useCommands()

  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { org } = useCurrentOrgAndRepoFromURL()

  return (
    <div className="flex h-[360px] flex-grow flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-1 overflow-y-scroll p-4">
        {commands.map((command) => {
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
              {command.type === CommandType.API && (
                <span className="py-.5 rounded-sm bg-blue-50 px-2 font-mono text-[9px] uppercase text-blue-500 dark:bg-blue-950 dark:text-blue-200">
                  {command.method}
                </span>
              )}
            </CommandItem>
          )
        })}
      </div>
    </div>
  )
}
