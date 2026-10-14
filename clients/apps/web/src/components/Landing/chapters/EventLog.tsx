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

const Row = ({ event, age }: { event: UsageEvent; age: number }) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="l"
    height={ROW}
    opacity={Math.max(0.25, 1 - age * 0.12)}
    transitionProperty="opacity"
    transitionDuration="slow"
  >
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <Text variant="caption" monospace color="muted">
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
export const EventLog = ({ events }: { events: UsageEvent[] }) => {
  const empty = Math.max(0, VISIBLE_EVENTS - events.length)
  return (
    <div
      className="relative w-full"
      style={{ height: VISIBLE_EVENTS * STEP - GAP }}
    >
      {events.map((event, position) => (
        <div
          key={event.id}
          className="absolute top-0 left-0 w-full transition-transform duration-[360ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ transform: `translateY(${position * STEP}px)` }}
        >
          <div className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            <Row event={event} age={position} />
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
