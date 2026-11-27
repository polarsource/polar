import { Text } from '@polar-sh/orbit'
import { differenceInDays } from 'date-fns'
import { Box } from '@polar-sh/orbit/Box'
import { X, ZoomIn, ZoomOut } from '@polar-sh/orbit/icons'
import { formatEventCount } from '@/utils/event'
import { ReactNode } from 'react'

export interface TimeRange {
  from: Date
  to: Date
}

const HOURLY_MAX_DAYS = 35

export const isHourlyRange = (start: Date, end: Date) =>
  differenceInDays(end, start) <= HOURLY_MAX_DAYS

export const formatBarStart = (date: Date, hourly: boolean) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(hourly ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  })

const formatDay = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

// Period ends are exclusive, so the last covered instant is a millisecond earlier.
// Parts shared with the start (day, month) are left out of the end.
export const formatTimeRange = ({ from, to }: TimeRange, hourly: boolean) => {
  const last = new Date(to.getTime() - 1)
  if (hourly) {
    return isSameDay(from, last)
      ? `${formatDay(from)}, ${formatTime(from)}–${formatTime(to)}`
      : `${formatDay(from)}, ${formatTime(from)} – ${formatDay(last)}, ${formatTime(to)}`
  }
  if (isSameDay(from, last)) return formatDay(from)
  if (
    from.getMonth() === last.getMonth() &&
    from.getFullYear() === last.getFullYear()
  )
    return `${formatDay(from)}–${last.getDate()}`
  return `${formatDay(from)} – ${formatDay(last)}`
}

const IconButton = ({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={!onClick}
    className="dark:text-polar-400 dark:hover:bg-polar-700 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:hover:text-white"
  >
    {children}
  </button>
)

const PILL_WIDTH = 320

const anchorProps = ({ start, end }: { start: number; end: number }) => ({
  left: `${((start + end) / 2) * 100}%`,
  transform: 'translateX(-50%)',
})

export const EventsHistogramControls = ({
  anchor,
  dragging,
  range,
  count,
  hourly,
  onZoomIn,
  onZoomOut,
  onClear,
}: {
  anchor: { start: number; end: number }
  dragging: boolean
  range: TimeRange
  count: number
  hourly: boolean
  onZoomIn?: () => void
  onZoomOut?: () => void
  onClear?: () => void
}) => (
  <Box position="relative" height={36}>
    <Box
      position="absolute"
      top={0}
      bottom={0}
      width="max-content"
      alignItems="center"
      transitionProperty={dragging ? 'none' : 'all'}
      transitionDuration="fast"
      ease="decelerate"
      {...anchorProps(anchor)}
    >
      <Box
        width={PILL_WIDTH}
        userSelect="none"
        alignItems="center"
        gap="s"
        paddingLeft="m"
        paddingRight="xs"
        paddingVertical="xs"
        borderRadius="full"
        backgroundColor="background-card"
      >
        <Box flexGrow={1} minWidth={0}>
          <Text variant="caption" tabularNums truncate>
            {formatTimeRange(range, hourly)}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text variant="caption" color="muted" tabularNums>
            {formatEventCount(count)} {count === 1 ? 'event' : 'events'}
          </Text>
        </Box>
        <Box
          height={14}
          borderLeftWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        />
        <Box alignItems="center">
          <IconButton label="Zoom in to selection" onClick={onZoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Zoom out" onClick={onZoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </IconButton>
          {onClear ? (
            <IconButton label="Clear selection" onClick={onClear}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          ) : (
            <Box width={28} height={28} />
          )}
        </Box>
      </Box>
    </Box>
  </Box>
)
