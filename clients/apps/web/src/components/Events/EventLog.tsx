import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect } from 'react'
import { EventLogHeader, EventLogRow } from './EventLogRow'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export const EventLog = ({
  events,
  selectedEventId,
  onSelect,
  onClose,
}: {
  events: schemas['Event'][]
  selectedEventId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && selectedEventId) {
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const index = events.findIndex((event) => event.id === selectedEventId)
      const next =
        e.key === 'ArrowDown'
          ? events[index + 1]
          : index > 0
            ? events[index - 1]
            : undefined
      if (!next) return
      e.preventDefault()
      onSelect(next.id)
      document
        .querySelector(`[data-event-id="${next.id}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [events, selectedEventId, onSelect, onClose])

  return (
    <Box flexDirection="column">
      <EventLogHeader />
      {events.map((event) => (
        <EventLogRow
          key={event.id}
          event={event}
          selected={event.id === selectedEventId}
          onSelect={() => onSelect(event.id)}
        />
      ))}
    </Box>
  )
}
