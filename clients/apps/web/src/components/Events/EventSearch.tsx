import { useCustomers, useCustomersByIds } from '@/hooks/queries'
import { useEventNames } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, X } from '@polar-sh/orbit/icons'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Metadata = Record<string, string | number | boolean>
type EventSource = schemas['EventSource']

interface Suggestion {
  section: 'Suggestions' | 'Filters'
  token: string
  hint?: string
  apply: () => void
}

const FILTER_PREFIXES = [
  { token: 'event:', hint: 'Event name' },
  { token: 'customer:', hint: 'Name or email' },
  { token: 'source:', hint: 'user or system' },
  { token: 'metadata.', hint: 'metadata.key:value' },
]

const TOKEN_PATTERN = /^([a-z]+(?:\.[^:\s]+)?):(.*)$/i

const Token = ({
  children,
  onRemove,
}: {
  children: string
  onRemove?: () => void
}) => (
  <Box
    as="span"
    display="inline-flex"
    alignItems="center"
    gap="xs"
    paddingHorizontal="xs"
    borderRadius="s"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    minWidth={0}
  >
    <Text as="span" variant="caption" truncate>
      {children}
    </Text>
    {onRemove && (
      <button
        type="button"
        className="cursor-pointer opacity-50 hover:opacity-100"
        aria-label={`Remove ${children}`}
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </Box>
)

export const EventSearch = ({
  organizationId,
  query,
  onQueryChange,
  selectedEventTypes,
  onEventTypesChange,
  selectedCustomerIds,
  onCustomerIdsChange,
  source,
  onSourceChange,
  metadata,
  onMetadataChange,
}: {
  organizationId: string
  query: string | null
  onQueryChange: (query: string | null) => void
  selectedEventTypes: string[]
  onEventTypesChange: (names: string[] | null) => void
  selectedCustomerIds: string[]
  onCustomerIdsChange: (ids: string[] | null) => void
  source: EventSource | null
  onSourceChange: (source: EventSource | null) => void
  metadata: Metadata
  onMetadataChange: (metadata: Metadata | null) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState(query ?? '')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const match = TOKEN_PATTERN.exec(input.trim())
  const field = match?.[1].toLowerCase() ?? null
  const value = match?.[2].trim().toLowerCase() ?? ''

  const { data: eventNames } = useEventNames(organizationId, {
    sorting: ['name'],
    limit: 500,
  })
  const eventTypes = eventNames?.pages.flatMap((page) => page.items) ?? []
  const { data: customerPages } = useCustomers(organizationId, {
    query: field === 'customer' ? value : undefined,
    limit: 8,
  })
  const customers = customerPages?.pages.flatMap((page) => page.items) ?? []
  const selectedCustomers = useCustomersByIds(selectedCustomerIds)

  const commit = (next: string) => {
    setInput(next)
    setHighlighted(0)
  }

  const addEventType = (name: string) => {
    if (!selectedEventTypes.includes(name)) {
      onEventTypesChange([...selectedEventTypes, name])
    }
    commit('')
  }

  const eventSuggestions = (filter: string, limit: number): Suggestion[] =>
    eventTypes
      .filter(
        (eventType) =>
          !selectedEventTypes.includes(eventType.name) &&
          (eventType.name.toLowerCase().includes(filter) ||
            eventType.label.toLowerCase().includes(filter)),
      )
      .toSorted((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit)
      .map((eventType) => ({
        section: 'Suggestions',
        token: `event:${eventType.name}`,
        hint: eventType.occurrences.toLocaleString('en-US'),
        apply: () => addEventType(eventType.name),
      }))

  const suggestions: Suggestion[] = (() => {
    if (field === 'event') return eventSuggestions(value, 8)
    if (field === 'customer') {
      return customers
        .filter((customer) => !selectedCustomerIds.includes(customer.id))
        .map((customer) => ({
          section: 'Suggestions',
          token: `customer:${customer.name ?? customer.email}`,
          hint: customer.name ? customer.email : undefined,
          apply: () => {
            onCustomerIdsChange([...selectedCustomerIds, customer.id])
            commit('')
          },
        }))
    }
    if (field === 'source') {
      return (['user', 'system'] as const)
        .filter((s) => s.startsWith(value))
        .map((s) => ({
          section: 'Suggestions',
          token: `source:${s}`,
          apply: () => {
            onSourceChange(s)
            commit('')
          },
        }))
    }
    if (field?.startsWith('metadata.') && value) {
      const key = field.slice('metadata.'.length)
      const raw = match?.[2].trim() ?? ''
      return [
        {
          section: 'Suggestions',
          token: `metadata.${key}:${raw}`,
          apply: () => {
            onMetadataChange({ ...metadata, [key]: raw })
            commit('')
          },
        },
      ]
    }
    const text = input.trim().toLowerCase()
    return [
      ...eventSuggestions(text, text ? 5 : 3),
      ...FILTER_PREFIXES.filter((prefix) => prefix.token.startsWith(text)).map(
        (prefix): Suggestion => ({
          section: 'Filters',
          token: prefix.token,
          hint: prefix.hint,
          apply: () => commit(prefix.token),
        }),
      ),
    ]
  })()

  const chips = [
    ...selectedEventTypes.map((name) => ({
      token: `event:${name}`,
      remove: () =>
        onEventTypesChange(selectedEventTypes.filter((n) => n !== name)),
    })),
    ...selectedCustomerIds.map((id, index) => {
      const customer = selectedCustomers[index]?.data
      return {
        token: `customer:${customer?.name ?? customer?.email ?? '…'}`,
        remove: () =>
          onCustomerIdsChange(selectedCustomerIds.filter((c) => c !== id)),
      }
    }),
    ...(source
      ? [{ token: `source:${source}`, remove: () => onSourceChange(null) }]
      : []),
    ...Object.entries(metadata).map(([key, v]) => ({
      token: `metadata.${key}:${v}`,
      remove: () => {
        const { [key]: _removed, ...rest } = metadata
        onMetadataChange(Object.keys(rest).length > 0 ? rest : null)
      },
    })),
  ]

  const onChange = (next: string) => {
    setInput(next)
    setHighlighted(0)
    setOpen(true)
    onQueryChange(TOKEN_PATTERN.test(next.trim()) ? null : next || null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlighted(
        (index) =>
          (index + step + suggestions.length) % Math.max(suggestions.length, 1),
      )
    } else if (e.key === 'Enter' && open && suggestions[highlighted]) {
      e.preventDefault()
      suggestions[highlighted].apply()
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && input === '' && chips.length > 0) {
      chips[chips.length - 1].remove()
    }
  }

  return (
    <div className="relative">
      <div
        className="dark:border-polar-700 dark:bg-polar-800 flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1 shadow-xs focus-within:border-blue-300 focus-within:ring-[3px] focus-within:ring-blue-100 dark:focus-within:border-blue-600 dark:focus-within:ring-blue-700/40"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="dark:text-polar-400 mr-1 h-4 w-4 shrink-0 text-gray-500" />
        {chips.map((chip) => (
          <Token key={chip.token} onRemove={chip.remove}>
            {chip.token}
          </Token>
        ))}
        <input
          ref={inputRef}
          value={input}
          placeholder={chips.length > 0 ? '' : 'Search events or filter…'}
          className="dark:placeholder:text-polar-500 min-w-40 flex-1 border-0 bg-transparent p-0 py-1 text-sm shadow-none ring-0 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none dark:text-white"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="dark:bg-polar-900 dark:border-polar-700 absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <Box flexDirection="column" paddingVertical="s">
            {suggestions.map((suggestion, index) => (
              <Box key={suggestion.token} flexDirection="column">
                {suggestion.section !== suggestions[index - 1]?.section && (
                  <Box paddingHorizontal="m" paddingVertical="xs">
                    <Text variant="caption" color="muted">
                      {suggestion.section}
                    </Text>
                  </Box>
                )}
                <button
                  type="button"
                  className={twMerge(
                    'w-full cursor-pointer text-left',
                    index === highlighted && 'dark:bg-polar-800 bg-gray-100',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={suggestion.apply}
                >
                  <Box
                    alignItems="center"
                    justifyContent="between"
                    gap="l"
                    paddingHorizontal="m"
                    paddingVertical="xs"
                  >
                    <Token>{suggestion.token}</Token>
                    {suggestion.hint && (
                      <Text variant="caption" color="muted" truncate>
                        {suggestion.hint}
                      </Text>
                    )}
                  </Box>
                </button>
              </Box>
            ))}
          </Box>
        </div>
      )}
    </div>
  )
}
