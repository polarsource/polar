'use client'

import { enums } from '@polar-sh/client'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

interface WebhookEventTypeSelectProps {
  selectedEventTypes: string[]
  onSelectEventTypes: (eventTypes: string[]) => void
  className?: string
}

export const WebhookEventTypeSelect = ({
  selectedEventTypes,
  onSelectEventTypes,
  className,
}: WebhookEventTypeSelectProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const allEventTypes = useMemo(
    () => Object.values(enums.webhookEventTypeValues),
    [],
  )

  const filteredEventTypes = useMemo(() => {
    if (!query) return allEventTypes
    return allEventTypes.filter((type) =>
      type.toLowerCase().includes(query.toLowerCase()),
    )
  }, [query, allEventTypes])

  const handleToggleEventType = useCallback(
    (eventType: string) => {
      if (selectedEventTypes.includes(eventType)) {
        onSelectEventTypes(selectedEventTypes.filter((t) => t !== eventType))
      } else {
        onSelectEventTypes([...selectedEventTypes, eventType])
      }
    },
    [selectedEventTypes, onSelectEventTypes],
  )

  const handleClearAll = useCallback(() => {
    onSelectEventTypes([])
  }, [onSelectEventTypes])

  const triggerLabel = useMemo(() => {
    if (selectedEventTypes.length === 0) {
      return 'All Event Types'
    }
    if (selectedEventTypes.length === 1) {
      return selectedEventTypes[0]
    }
    return `${selectedEventTypes.length} event types`
  }, [selectedEventTypes])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`dark:border-polar-700 dark:bg-polar-800 dark:text-polar-300 dark:hover:bg-polar-700 flex h-10 items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-xs hover:bg-gray-50 ${className ?? ''}`}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b p-2">
          <input
            type="text"
            placeholder="Search event types..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="dark:bg-polar-800 dark:text-polar-200 dark:placeholder:text-polar-500 w-full rounded-md border-0 bg-gray-50 px-3 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="dark:border-polar-700 flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs text-gray-500">
            {selectedEventTypes.length === 0
              ? 'All events'
              : `${selectedEventTypes.length} selected`}
          </span>
          {selectedEventTypes.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredEventTypes.length > 0 ? (
            filteredEventTypes.map((eventType) => (
              <label
                key={eventType}
                className="dark:hover:bg-polar-700 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedEventTypes.includes(eventType)}
                  onCheckedChange={() => handleToggleEventType(eventType)}
                />
                <span className="text-sm">{eventType}</span>
              </label>
            ))
          ) : (
            <div className="dark:text-polar-500 py-4 text-center text-sm text-gray-500">
              No event types found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default WebhookEventTypeSelect
