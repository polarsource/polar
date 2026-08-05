import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { resolveTimelineEventHref } from './links'
import type { TimelineEntry } from './renderers'

export const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TimelineItemProps {
  event: schemas['Event']
  entry: TimelineEntry
  organizationSlug: string
}

export const TimelineItem = ({
  event,
  entry,
  organizationSlug,
}: TimelineItemProps) => (
  <Link
    href={resolveTimelineEventHref(event, organizationSlug)}
    className="block"
  >
    <Box
      columnGap="m"
      paddingVertical="s"
      paddingHorizontal="m"
      borderRadius="s"
      backgroundColor={{ hover: 'background-card' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center text-sm text-black dark:text-white">
        {entry.icon}
      </span>
      <Box flexDirection="column" flexGrow={1} minWidth={0}>
        <Box alignItems="baseline" justifyContent="between" columnGap="m">
          <Text variant="title" truncate>
            {entry.title}
          </Text>
          <Tooltip>
            <TooltipTrigger>
              <Text variant="caption" color="muted" wrap="nowrap">
                {formatRelativeTime(event.timestamp)}
              </Text>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">
              {new Date(event.timestamp).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}
            </TooltipContent>
          </Tooltip>
        </Box>
        {entry.summary ? (
          <Text variant="caption" color="muted" truncate>
            {entry.summary}
          </Text>
        ) : null}
      </Box>
    </Box>
  </Link>
)

interface TimelineFoldProps {
  count: number
  expanded: boolean
  onToggle: () => void
}

export const TimelineFold = ({
  count,
  expanded,
  onToggle,
}: TimelineFoldProps) => (
  <Box
    alignItems="center"
    columnGap="m"
    paddingVertical="s"
    paddingHorizontal="m"
    borderRadius="s"
    backgroundColor={{ hover: 'background-card' }}
    transitionProperty="colors"
    transitionDuration="fast"
    cursor={{ hover: 'pointer' }}
    onClick={onToggle}
    aria-expanded={expanded}
  >
    <span className="flex h-5 w-4 shrink-0 items-center justify-center">
      <ChevronRightIcon
        className={twMerge(
          'dark:text-polar-500 size-3.5 text-gray-500 transition-transform',
          expanded && 'rotate-90',
        )}
        strokeWidth={1.5}
      />
    </span>
    <Text variant="caption" color="muted">
      {expanded
        ? 'Hide collapsed events'
        : `${count} collapsed ${count === 1 ? 'event' : 'events'}`}
    </Text>
  </Box>
)
