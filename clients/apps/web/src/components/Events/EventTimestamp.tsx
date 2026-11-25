import { ENTITY_CHIP_CLASS } from '@/components/Shared/EntityLink'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { TimestampDetails, useNow } from './TimestampDetails'
import {
  formatDay,
  formatEventTimestamp,
  formatRelativeShort,
  formatTimeOfDay,
} from './timestampFormat'
import { TimestampMenu } from './TimestampMenu'

// How a moment is written out:
// - date: Jan 15, 2026
// - datetime: Jan 15, 2026 10:00
// - precise: Jan 15, 10:00:05
// - relative: 3h ago
export type TimestampFormat = 'date' | 'datetime' | 'precise' | 'relative'

// A relative time only changes by the minute.
const RELATIVE_REFRESH = 60_000

const RelativeLabel = ({ date, muted }: { date: Date; muted: boolean }) => {
  const now = useNow(RELATIVE_REFRESH)
  return (
    <Text color={muted ? 'muted' : 'default'} tabularNums>
      {formatRelativeShort(date, now)}
    </Text>
  )
}

const TimestampLabel = ({
  timestamp,
  format,
  muted,
}: {
  timestamp: string
  format: TimestampFormat
  muted: boolean
}) => {
  const date = new Date(timestamp)
  const color = muted ? 'muted' : 'default'
  if (format === 'relative') return <RelativeLabel date={date} muted={muted} />
  if (format === 'precise') {
    return (
      <Text color={color} tabularNums>
        {formatEventTimestamp(timestamp)}
      </Text>
    )
  }
  if (format === 'datetime') {
    return (
      <Box alignItems="baseline" columnGap="s">
        <Text color={color} tabularNums>
          {formatDay(date)}
        </Text>
        <Text color="muted" tabularNums>
          {formatTimeOfDay(date)}
        </Text>
      </Box>
    )
  }
  return (
    <Text color={color} tabularNums>
      {formatDay(date)}
    </Text>
  )
}

// A timestamp is never cut short, and its chip can be all its container holds,
// where a width limit would cut the highlight short of the text.
const CHIP_CLASS = twMerge(ENTITY_CHIP_CLASS, 'max-w-none shrink-0')
const TRIGGER_CLASS =
  'inline-flex min-w-0 cursor-default py-0.5 whitespace-nowrap'

// A moment in time, written in the given format. It lights up like an entity
// link when pointed at and says more about itself in a tooltip. The arrow
// beside it opens ways to copy it and to filter lists by it.
export const EventTimestamp = ({
  timestamp,
  format = 'date',
  muted = false,
  focusable = true,
  align = 'start',
  children,
}: {
  timestamp: string
  format?: TimestampFormat
  muted?: boolean
  focusable?: boolean
  // The side the timestamp is flush with. The arrow takes the other one, so
  // the room kept for it does not push the text off its edge.
  align?: 'start' | 'end'
  // In place of the format, for a moment that needs writing some other way.
  children?: ReactNode
}) => (
  <span className={twMerge(CHIP_CLASS, align === 'end' && 'flex-row-reverse')}>
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          className={`${TRIGGER_CLASS} ${align === 'end' ? 'pr-1.5 pl-1' : 'pr-1 pl-1.5'}`}
          tabIndex={focusable ? 0 : undefined}
        >
          {children ?? (
            <TimestampLabel
              timestamp={timestamp}
              format={format}
              muted={muted}
            />
          )}
        </span>
      </TooltipTrigger>
      {/* Kept clear of the arrow, which is on the left when flush right. */}
      <TooltipContent
        side={align === 'end' ? 'top' : 'left'}
        align={align === 'end' ? 'end' : 'center'}
        className="p-3"
      >
        <TimestampDetails date={new Date(timestamp)} />
      </TooltipContent>
    </Tooltip>
    {/* The menu can sit inside a row that is a link or selects on click.
        Neither should happen for a click that was meant for the menu. */}
    <span
      className="flex self-stretch"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <TimestampMenu timestamp={timestamp} />
    </span>
  </span>
)
