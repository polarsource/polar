import { schemas } from '@polar-sh/client'
import { Checkbox, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

const VISIBLE_COUNT = 8

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
})

type EventTypeRow = Pick<
  schemas['EventTypeWithStats'],
  'name' | 'label' | 'source' | 'occurrences'
>

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
  const [expanded, setExpanded] = useState(false)

  const selectedSet = new Set(selected)
  const known = new Set(eventTypes.map((eventType) => eventType.name))
  // Keep selected types listed even when no events match, so they can be unticked.
  const rows: EventTypeRow[] = [
    ...eventTypes,
    ...selected
      .filter((name) => !known.has(name))
      .map((name) => ({
        name,
        label: name,
        source: 'user' as const,
        occurrences: 0,
      })),
  ]

  const sorted = rows.toSorted(
    (a, b) =>
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      b.occurrences - a.occurrences,
  )

  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_COUNT)
  const hiddenCount = sorted.length - visible.length

  if (rows.length === 0) {
    return <Text color="muted">No matching events</Text>
  }

  return (
    <Box flexDirection="column" gap="s">
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
                  color={selectedSet.has(eventType.name) ? 'default' : 'muted'}
                  truncate
                >
                  {eventType.label}
                </Text>
              </Box>
              <Text color="muted" tabularNums>
                {compactNumber.format(eventType.occurrences)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          className="cursor-pointer self-start"
          onClick={() => setExpanded(!expanded)}
        >
          <Text color="muted">
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </Text>
        </button>
      )}
    </Box>
  )
}
