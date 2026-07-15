import { useSlackWorkspaceUsers } from '@/hooks/queries'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { Button } from '@polar-sh/orbit'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { CheckIcon, XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  integrationId: string
  value: string[]
  onChange: (value: string[]) => void
}

export const SlackTeamInviteesSelect = ({
  integrationId,
  value,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false)
  const { data: users, isLoading } = useSlackWorkspaceUsers(integrationId)

  const selectedUsers = useMemo(
    () => (users ?? []).filter((u) => value.includes(u.id)),
    [users, value],
  )

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  const label = (() => {
    if (isLoading) return 'Loading workspace members...'
    if (value.length === 0) return 'Select team members'
    if (value.length === 1)
      return selectedUsers[0]?.real_name || selectedUsers[0]?.name || '1 member'
    return `${value.length} members selected`
  })()

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className="ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 flex h-10 w-full! flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-2 font-sans text-sm font-medium shadow-xs transition-colors hover:border-gray-300 hover:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
            wrapperClassNames="justify-between w-full"
          >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              {label}
            </div>
            <ExpandMoreOutlined className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput
              className="border-none focus:ring-transparent"
              placeholder="Search members..."
            />
            <CommandList>
              <CommandEmpty>No members found</CommandEmpty>
              <CommandGroup>
                {(users ?? []).map((user) => {
                  const selected = value.includes(user.id)
                  return (
                    <CommandItem
                      key={user.id}
                      value={`${user.real_name ?? ''} ${user.name} ${user.id}`}
                      onSelect={() => toggle(user.id)}
                      className="dark:data-[selected=true]:bg-polar-800 flex flex-row items-center justify-between data-[selected=true]:bg-gray-100 data-[selected=true]:text-black dark:data-[selected=true]:text-white"
                    >
                      <div className="flex flex-col">
                        <span>{user.real_name || user.name}</span>
                        <span className="dark:text-polar-400 text-xs text-gray-500">
                          @{user.name}
                          {user.is_admin ? ' · admin' : ''}
                        </span>
                      </div>
                      <CheckIcon
                        className={twMerge(
                          'h-4 w-4',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {!isLoading && value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => {
            const user = (users ?? []).find((u) => u.id === id)
            const name = user ? user.real_name || user.name : id
            return (
              <div
                key={id}
                className="dark:bg-polar-800 flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${name}`}
                  className="opacity-60 hover:opacity-100"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
