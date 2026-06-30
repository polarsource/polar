import { useEventNames } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const EVENT_SOURCE_LABELS: Record<schemas['EventSource'], string> = {
  system: 'System Events',
  user: 'Custom Events',
}

const EventsCommandGroup = ({
  source,
  eventNames,
  value,
  onSelectEvent,
  onSelectAll,
}: {
  source: schemas['EventSource']
  eventNames: schemas['EventName'][]
  value: string[]
  onSelectEvent: (name: string) => void
  onSelectAll: (names: string[]) => void
}) => {
  const names = useMemo(() => eventNames.map(({ name }) => name), [eventNames])
  const areAllSelected = useMemo(
    () => names.length > 0 && names.every((name) => value.includes(name)),
    [names, value],
  )

  if (eventNames.length === 0) {
    return null
  }

  return (
    <CommandGroup>
      <CommandItem
        className="flex flex-row items-center justify-between py-2 text-black dark:text-white"
        value={source}
        onSelect={() => onSelectAll(names)}
      >
        <span className="font-medium">{EVENT_SOURCE_LABELS[source]}</span>
        <span className="text-xs opacity-70">
          {areAllSelected ? 'Deselect all' : `Select all ${names.length}`}
        </span>
      </CommandItem>
      {eventNames.map((eventName) => (
        <CommandItem
          className="flex flex-row items-center justify-between text-black dark:text-white"
          key={eventName.name}
          value={eventName.name}
          onSelect={() => onSelectEvent(eventName.name)}
        >
          {eventName.label}
          <Check
            className={twMerge(
              'ml-auto h-4 w-4',
              value.includes(eventName.name) ? 'opacity-100' : 'opacity-0',
            )}
          />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

interface EventSelectProps {
  organizationId: string
  value: string[]
  onChange: (value: string[]) => void
  emptyLabel?: string
  className?: string
}

const EventSelect: React.FC<EventSelectProps> = ({
  organizationId,
  value,
  onChange,
  emptyLabel,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { data } = useEventNames(organizationId, {
    limit: 100,
    sorting: ['name'],
  })

  const eventNames = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const groupedEventNames = useMemo<
    Record<schemas['EventSource'], schemas['EventName'][]>
  >(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return eventNames.reduce<
      Record<schemas['EventSource'], schemas['EventName'][]>
    >(
      (acc, eventName) => {
        if (
          normalizedQuery &&
          !eventName.name.toLowerCase().includes(normalizedQuery) &&
          !eventName.label.toLowerCase().includes(normalizedQuery)
        ) {
          return acc
        }
        return {
          ...acc,
          [eventName.source]: [...acc[eventName.source], eventName],
        }
      },
      { system: [], user: [] },
    )
  }, [eventNames, query])

  const hasResults =
    groupedEventNames.system.length > 0 || groupedEventNames.user.length > 0

  const buttonLabel = useMemo(() => {
    if (value.length === 0) {
      return emptyLabel || 'All events'
    }
    if (value.length === 1) {
      const selected = eventNames.find(({ name }) => name === value[0])
      return selected?.label ?? value[0]
    }
    return `${value.length} events`
  }, [value, emptyLabel, eventNames])

  const onSelectEvent = useCallback(
    (name: string) => {
      if (value.includes(name)) {
        onChange(value.filter((selected) => selected !== name))
      } else {
        onChange([...value, name])
      }
    },
    [onChange, value],
  )

  const onSelectAll = useCallback(
    (names: string[]) => {
      const allSelected = names.every((name) => value.includes(name))
      if (allSelected) {
        onChange(value.filter((selected) => !names.includes(selected)))
      } else {
        onChange([
          ...value,
          ...names.filter((name) => !value.includes(name)),
        ])
      }
    },
    [onChange, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'dark:bg-polar-800 dark:hover:bg-polar-700 dark:hover:border-polar-700 dark:border-polar-700 flex w-full flex-row justify-between gap-x-2 rounded-lg border border-gray-200 bg-white px-3 font-normal shadow-xs transition-colors hover:bg-gray-50 hover:text-black dark:hover:text-white',
            className,
          )}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {buttonLabel}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) rounded-xl p-0"
      >
        <Command shouldFilter={false} className="rounded-xl">
          <CommandInput
            className="h-9 border-0 focus:ring-0 focus:outline-0"
            placeholder="Search events…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {hasResults ? (
              <>
                <EventsCommandGroup
                  source="system"
                  eventNames={groupedEventNames.system}
                  value={value}
                  onSelectEvent={onSelectEvent}
                  onSelectAll={onSelectAll}
                />
                {groupedEventNames.system.length > 0 &&
                  groupedEventNames.user.length > 0 && <CommandSeparator />}
                <EventsCommandGroup
                  source="user"
                  eventNames={groupedEventNames.user}
                  value={value}
                  onSelectEvent={onSelectEvent}
                  onSelectAll={onSelectAll}
                />
              </>
            ) : (
              <CommandEmpty>No events found</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default EventSelect
