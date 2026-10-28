import { schemas } from '@polar-sh/client'
import { Checkbox, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search } from '@polar-sh/orbit/icons'
import { useState } from 'react'

const VISIBLE_COUNT = 8

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
})

const SOURCE_ORDER: Record<schemas['EventSource'], number> = {
  user: 0,
  system: 1,
}

export const EventTypeFilter = ({
  eventTypes,
  selected,
  onToggle,
}: {
  eventTypes: schemas['EventTypeWithStats'][]
  selected: string[]
  onToggle: (name: string) => void
}) => {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const selectedSet = new Set(selected)
  const normalizedQuery = query.trim().toLowerCase()

  const sorted = eventTypes
    .filter(
      (eventType) =>
        !normalizedQuery ||
        eventType.label.toLowerCase().includes(normalizedQuery) ||
        eventType.name.toLowerCase().includes(normalizedQuery),
    )
    .toSorted(
      (a, b) =>
        Number(selectedSet.has(b.name)) - Number(selectedSet.has(a.name)) ||
        SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
        b.occurrences - a.occurrences,
    )

  const visible =
    expanded || normalizedQuery
      ? sorted
      : sorted.slice(0, Math.max(VISIBLE_COUNT, selected.length))
  const hiddenCount = sorted.length - visible.length

  if (eventTypes.length === 0) {
    return (
      <Text variant="caption" color="muted">
        No events yet
      </Text>
    )
  }

  return (
    <Box flexDirection="column" gap="s">
      {eventTypes.length > VISIBLE_COUNT && (
        <Input
          placeholder="Filter events"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          preSlot={<Search className="h-4 w-4" />}
        />
      )}
      <Box as="ul" flexDirection="column">
        {visible.map((eventType) => (
          <Box as="li" key={eventType.name}>
            <Box
              as="label"
              display="flex"
              alignItems="center"
              gap="s"
              paddingVertical="xs"
              width="100%"
              cursor="pointer"
            >
              <Checkbox
                checked={selectedSet.has(eventType.name)}
                onCheckedChange={() => onToggle(eventType.name)}
              />
              <Box flexGrow={1} minWidth={0}>
                <Text
                  variant="caption"
                  color={selectedSet.has(eventType.name) ? 'default' : 'muted'}
                  truncate
                >
                  {eventType.label}
                </Text>
              </Box>
              <Text variant="caption" color="muted" tabularNums>
                {compactNumber.format(eventType.occurrences)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      {normalizedQuery && sorted.length === 0 && (
        <Text variant="caption" color="muted">
          No matching events
        </Text>
      )}
      {!normalizedQuery && (hiddenCount > 0 || expanded) && (
        <button
          type="button"
          className="cursor-pointer self-start"
          onClick={() => setExpanded(!expanded)}
        >
          <Text variant="caption" color="muted">
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </Text>
        </button>
      )}
    </Box>
  )
}
