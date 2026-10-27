'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  count,
  dollars,
  VISIBLE_EVENTS,
  type UsageEvent,
} from './useUsageStream'

const ROW = 18
const GAP = 8
const STEP = ROW + GAP

const Row = ({
  event,
  age,
  fade,
  customer,
}: {
  event: UsageEvent
  age: number
  fade: boolean
  customer?: string
}) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="l"
    height={ROW}
    opacity={fade ? Math.max(0.25, 1 - age * 0.12) : 1}
    transitionProperty="opacity"
    transitionDuration="slow"
  >
    <Box alignItems="center" columnGap="s" minWidth={0}>
      {customer ? (
        <Box width={80} flexShrink={0}>
          <Text variant="caption">{customer}</Text>
        </Box>
      ) : null}
      <Text variant="caption" monospace>
        {event.name}
      </Text>
    </Box>
    <Box alignItems="baseline" columnGap="l" flexShrink={0}>
      <Text variant="caption" color="muted" tabularNums>
        {count(event.quantity)}
      </Text>
      <Box minWidth={64} justifyContent="end">
        <Text variant="caption" tabularNums>
          {dollars(event.revenue, 2)}
        </Text>
      </Box>
    </Box>
  </Box>
)

const Skeleton = () => (
  <Box alignItems="center" justifyContent="between" columnGap="l" height={ROW}>
    <Box
      width={120}
      height={10}
      backgroundColor="background-card"
      borderRadius="s"
    />
    <Box alignItems="center" columnGap="l">
      <Box
        width={40}
        height={10}
        backgroundColor="background-card"
        borderRadius="s"
      />
      <Box
        width={56}
        height={10}
        backgroundColor="background-card"
        borderRadius="s"
      />
    </Box>
  </Box>
)

/**
 * The newest event at the top. Rows are absolutely placed by position, so an arriving event pushes the others
 * down with a transform transition instead of remounting them. Keyed by id, a row mounts once, so the entrance
 * animation only ever plays for the newcomer.
 */
export const EventLog = ({
  events,
  rows = VISIBLE_EVENTS,
  fade = true,
  customerOf,
}: {
  events: UsageEvent[]
  rows?: number
  /** Older rows fade back; off for a long log, where it would wash out the bottom. */
  fade?: boolean
  /** Who sent each event, shown ahead of its name when given. */
  customerOf?: (event: UsageEvent) => string
}) => {
  const empty = Math.max(0, rows - events.length)
  return (
    <div className="relative w-full" style={{ height: rows * STEP - GAP }}>
      {events.map((event, position) => (
        <div
          key={event.id}
          className="absolute top-0 left-0 w-full transition-transform duration-[360ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ transform: `translateY(${position * STEP}px)` }}
        >
          <div className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            <Row
              event={event}
              age={position}
              fade={fade}
              customer={customerOf?.(event)}
            />
          </div>
        </div>
      ))}
      {Array.from({ length: empty }, (_, slot) => (
        <div
          key={`empty-${slot}`}
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${(events.length + slot) * STEP}px)`,
          }}
        >
          <Skeleton />
        </div>
      ))}
    </div>
  )
}
