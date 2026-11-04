import { useCustomer, useCustomers, useCustomersByIds } from '@/hooks/queries'
import { useEventNames } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, X } from '@polar-sh/orbit/icons'
import { DateRangeInterval } from '@/components/Metrics/DateRangePicker'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Metadata = Record<string, string | number | boolean>
type EventSource = schemas['EventSource']

type ChipKind = 'time' | 'event' | 'customer' | 'source' | 'metadata'

interface Chip {
  kind: ChipKind
  value: string
  token: string
  edit: string
  remove?: () => void
}

interface Suggestion {
  section: 'Suggestions' | 'Filters' | 'Event'
  kind?: ChipKind
  token: string
  hint?: string
  apply: () => void
}

const FILTER_PREFIXES = [
  { token: 'event:', hint: 'Event name' },
  { token: 'customer:', hint: 'Name or email' },
  { token: 'source:', hint: 'user or system' },
  { token: 'time:', hint: 'Time range' },
  { token: 'metadata.', hint: 'metadata.key:value' },
]

const TOKEN_PATTERN = /^([a-z]+(?:\.[^:\s]+)?):(.*)$/i
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const inputToQuery = (input: string) => {
  const trimmed = input.trim()
  return TOKEN_PATTERN.test(trimmed) || UUID_PATTERN.test(trimmed)
    ? null
    : input || null
}

const Token = ({
  children,
  colon = false,
  onEdit,
  onRemove,
}: {
  children: string
  colon?: boolean
  onEdit?: () => void
  onRemove?: () => void
}) => {
  const separator = children.indexOf(':')
  const field = separator >= 0 ? children.slice(0, separator) : children
  const value = separator >= 0 ? children.slice(separator + 1) : ''

  const label = (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="xs"
      paddingLeft="m"
      paddingRight={onRemove ? 'xs' : 'm'}
      paddingVertical="xs"
      minWidth={0}
    >
      {colon ? (
        <Text as="span" truncate>
          <Text as="span" color="muted">
            {field}
            {separator >= 0 ? ':' : ''}
          </Text>
          {value}
        </Text>
      ) : (
        <>
          <Text as="span" color="muted">
            {field}
          </Text>
          {value && (
            <Text as="span" truncate>
              {value}
            </Text>
          )}
        </>
      )}
    </Box>
  )

  return (
    <span
      className={twMerge(
        'dark:bg-polar-900 inline-flex min-w-0 items-center rounded-full bg-gray-100 transition-colors',
        onEdit && 'dark:hover:bg-polar-700 hover:bg-gray-200',
      )}
    >
      {onEdit ? (
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center rounded-full text-left"
          aria-label={`Edit ${children}`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          {label}
        </button>
      ) : (
        label
      )}
      {onRemove && (
        <button
          type="button"
          className="dark:text-polar-500 dark:hover:text-polar-200 flex cursor-pointer items-center pr-2 text-gray-400 hover:text-gray-700"
          aria-label={`Remove ${children}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

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
  timeRangeLabel,
  onClearTimeRange,
  timeRanges,
  onTimeRangeChange,
  onOpenEvent,
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
  timeRangeLabel: string | null
  onClearTimeRange?: () => void
  timeRanges: DateRangeInterval[]
  onTimeRangeChange: (interval: DateRangeInterval) => void
  onOpenEvent: (id: string) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState(query ?? '')
  const [syncedQuery, setSyncedQuery] = useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    if (query !== inputToQuery(input)) {
      setInput(query ?? '')
    }
  }
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [editing, setEditing] = useState<Chip | null>(null)
  const editingValue = (kind: ChipKind) =>
    editing?.kind === kind ? editing.value : null
  const eventTypesBase = selectedEventTypes.filter(
    (name) => name !== editingValue('event'),
  )
  const customerIdsBase = selectedCustomerIds.filter(
    (id) => id !== editingValue('customer'),
  )
  const metadataBase = Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => key !== editingValue('metadata'),
    ),
  )

  const match = TOKEN_PATTERN.exec(input.trim())
  const rawField = match?.[1] ?? null
  const field = rawField?.toLowerCase() ?? null
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
  const { data: customerById } = useCustomer(
    field === 'customer' && UUID_PATTERN.test(value) ? value : null,
  )
  const customers = [
    ...(customerById ? [customerById] : []),
    ...(customerPages?.pages.flatMap((page) => page.items) ?? []).filter(
      (customer) => customer.id !== customerById?.id,
    ),
  ]
  const selectedCustomers = useCustomersByIds(selectedCustomerIds)

  const commit = (next: string) => {
    setInput(next)
    setHighlighted(-1)
    onQueryChange(null)
  }

  const addEventType = (name: string) => {
    onEventTypesChange(
      eventTypesBase.includes(name)
        ? eventTypesBase
        : [...eventTypesBase, name],
    )
    commit('')
  }

  const eventSuggestions = (filter: string, limit: number): Suggestion[] =>
    eventTypes
      .filter(
        (eventType) =>
          !eventTypesBase.includes(eventType.name) &&
          (eventType.name.toLowerCase().includes(filter) ||
            eventType.label.toLowerCase().includes(filter)),
      )
      .toSorted((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit)
      .map((eventType) => ({
        section: 'Suggestions',
        kind: 'event',
        token: `event:${eventType.name}`,
        hint: eventType.occurrences.toLocaleString('en-US'),
        apply: () => addEventType(eventType.name),
      }))

  const suggestions: Suggestion[] = (() => {
    const trimmed = input.trim()
    if (UUID_PATTERN.test(trimmed)) {
      return [
        {
          section: 'Event',
          token: `id:${trimmed}`,
          hint: 'Open event',
          apply: () => {
            onOpenEvent(trimmed)
            commit('')
          },
        },
      ]
    }
    if (field === 'event') return eventSuggestions(value, 8)
    if (field === 'customer') {
      return customers
        .filter((customer) => !customerIdsBase.includes(customer.id))
        .map((customer) => ({
          section: 'Suggestions',
          kind: 'customer',
          token: `customer:${customer.name ?? customer.email}`,
          hint: customer.name ? (customer.email ?? undefined) : undefined,
          apply: () => {
            onCustomerIdsChange([...customerIdsBase, customer.id])
            commit('')
          },
        }))
    }
    if (field === 'time') {
      return timeRanges
        .filter((interval) => interval.label.toLowerCase().includes(value))
        .map((interval) => ({
          section: 'Suggestions',
          kind: 'time',
          token: `time:${interval.label}`,
          apply: () => {
            onTimeRangeChange(interval)
            commit('')
          },
        }))
    }
    if (field === 'source') {
      return (['user', 'system'] as const)
        .filter((s) => s.startsWith(value))
        .map((s) => ({
          section: 'Suggestions',
          kind: 'source',
          token: `source:${s}`,
          apply: () => {
            onSourceChange(s)
            commit('')
          },
        }))
    }
    if (rawField && field?.startsWith('metadata.') && value) {
      const key = rawField.slice('metadata.'.length)
      const raw = match?.[2].trim() ?? ''
      return [
        {
          section: 'Suggestions',
          kind: 'metadata',
          token: `metadata.${key}:${raw}`,
          apply: () => {
            const existing = metadata[key]
            onMetadataChange({
              ...metadataBase,
              [key]:
                existing !== undefined && String(existing) === raw
                  ? existing
                  : raw,
            })
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

  const chips: Chip[] = [
    ...(timeRangeLabel
      ? [
          {
            kind: 'time',
            value: timeRangeLabel,
            token: `time:${timeRangeLabel}`,
            edit: 'time:',
            remove: onClearTimeRange,
          } satisfies Chip,
        ]
      : []),
    ...selectedEventTypes.map(
      (name): Chip => ({
        kind: 'event',
        value: name,
        token: `event:${name}`,
        edit: `event:${name}`,
        remove: () =>
          onEventTypesChange(selectedEventTypes.filter((n) => n !== name)),
      }),
    ),
    ...selectedCustomerIds.map((id, index): Chip => {
      const customer = selectedCustomers[index]?.data
      const label = customer?.name ?? customer?.email ?? '…'
      return {
        kind: 'customer',
        value: id,
        token: `customer:${label}`,
        edit: `customer:${customer ? label : ''}`,
        remove: () =>
          onCustomerIdsChange(selectedCustomerIds.filter((c) => c !== id)),
      }
    }),
    ...(source
      ? [
          {
            kind: 'source',
            value: source,
            token: `source:${source}`,
            edit: 'source:',
            remove: () => onSourceChange(null),
          } satisfies Chip,
        ]
      : []),
    ...Object.entries(metadata).map(
      ([key, v]): Chip => ({
        kind: 'metadata',
        value: key,
        token: `metadata.${key}:${v}`,
        edit: `metadata.${key}:${v}`,
        remove: () => {
          const { [key]: _removed, ...rest } = metadata
          onMetadataChange(Object.keys(rest).length > 0 ? rest : null)
        },
      }),
    ),
  ]
  const visibleChips = chips.filter(
    (chip) => chip.kind !== editing?.kind || chip.value !== editing.value,
  )

  const startEditing = (chip: Chip) => {
    setEditing(chip)
    setInput(chip.edit)
    setHighlighted(-1)
    setOpen(true)
    onQueryChange(null)
    inputRef.current?.focus()
  }

  const stopEditing = () => {
    if (!editing) return
    setEditing(null)
    setInput('')
    onQueryChange(null)
  }

  const runSuggestion = (suggestion: Suggestion) => {
    if (editing && suggestion.kind && suggestion.kind !== editing.kind) {
      editing.remove?.()
    }
    suggestion.apply()
    if (suggestion.kind) setEditing(null)
  }

  const onChange = (next: string) => {
    if (editing && next === '') {
      editing.remove?.()
      setEditing(null)
    }
    setInput(next)
    setHighlighted(-1)
    setOpen(true)
    onQueryChange(inputToQuery(next))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlighted((index) =>
        index < 0
          ? step > 0
            ? 0
            : suggestions.length - 1
          : (index + step + suggestions.length) %
            Math.max(suggestions.length, 1),
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = input.trim()
      const isFilter = TOKEN_PATTERN.test(trimmed) || UUID_PATTERN.test(trimmed)
      const suggestion =
        suggestions[highlighted] ?? (isFilter ? suggestions[0] : undefined)
      if (open && suggestion) {
        runSuggestion(suggestion)
      } else {
        inputRef.current?.blur()
      }
    } else if (e.key === ' ' && editing) {
      e.preventDefault()
      const suggestion = suggestions[highlighted] ?? suggestions[0]
      if (suggestion?.kind) runSuggestion(suggestion)
      else stopEditing()
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && input === '' && !editing) {
      const last = visibleChips.at(-1)
      if (last) {
        e.preventDefault()
        startEditing(last)
      }
    }
  }

  return (
    <div className="relative">
      <div
        className="dark:border-polar-700 dark:bg-polar-800 flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1 shadow-xs focus-within:border-blue-300 focus-within:ring-[3px] focus-within:ring-blue-100 dark:focus-within:border-blue-600 dark:focus-within:ring-blue-700/40"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="dark:text-polar-400 mr-1 h-4 w-4 shrink-0 text-gray-500" />
        {visibleChips.map((chip) => (
          <Token
            key={chip.token}
            onEdit={() => startEditing(chip)}
            onRemove={chip.remove}
          >
            {chip.token}
          </Token>
        ))}
        <input
          ref={inputRef}
          value={input}
          placeholder={
            visibleChips.length > 0 ? '' : 'Search events or filter…'
          }
          className="dark:placeholder:text-polar-500 min-w-24 flex-1 border-0 bg-transparent p-0 py-1 text-sm shadow-none ring-0 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none dark:text-white"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            stopEditing()
          }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="dark:bg-polar-900 dark:border-polar-700 absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <Box
            flexDirection="column"
            paddingVertical="s"
            onMouseLeave={() => setHighlighted(-1)}
          >
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
                  onClick={() => runSuggestion(suggestion)}
                >
                  <Box
                    alignItems="center"
                    justifyContent="between"
                    gap="l"
                    paddingHorizontal="m"
                    paddingVertical="xs"
                  >
                    <Token colon>{suggestion.token}</Token>
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
