'use client'

import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Fragment, useMemo, useState } from 'react'
import { resolveTimelineEntry, type TimelineEntry } from './renderers'
import { TimelineFold, TimelineItem } from './TimelineItem'

const DEFAULT_EVENT_COUNT = 50
const FOLD_THRESHOLD = 1

interface TimelineEventItem {
  event: schemas['Event']
  entry: TimelineEntry
}

type TimelineSegment =
  | { type: 'event'; item: TimelineEventItem }
  | { type: 'fold'; items: TimelineEventItem[] }

const buildSegments = (events: schemas['Event'][]): TimelineSegment[] => {
  const segments: TimelineSegment[] = []
  let buffer: TimelineEventItem[] = []

  const flush = () => {
    if (buffer.length >= FOLD_THRESHOLD) {
      segments.push({ type: 'fold', items: buffer })
    } else {
      segments.push(...buffer.map((item) => ({ type: 'event' as const, item })))
    }
    buffer = []
  }

  for (const event of events) {
    const entry = resolveTimelineEntry(event)
    if (!entry) {
      continue
    }
    const item = { event, entry }
    if (item.entry.importance === 'low') {
      buffer.push(item)
    } else {
      flush()
      segments.push({ type: 'event', item })
    }
  }
  flush()

  return segments
}

export interface TimelineProps {
  organizationId: string
  organizationSlug: string
  customerId?: string
  source?: schemas['EventSource']
  limit?: number
  viewAllHref?: string
  emptyMessage?: string
}

export const Timeline = ({
  organizationId,
  organizationSlug,
  customerId,
  source,
  limit = DEFAULT_EVENT_COUNT,
  viewAllHref,
  emptyMessage = 'Events will appear here.',
}: TimelineProps) => {
  const [expandedFolds, setExpandedFolds] = useState<Set<string>>(new Set())

  const events = useEvents(organizationId, {
    limit,
    sorting: ['-timestamp'],
    depth: 0,
    ...(customerId ? { customer_id: customerId } : {}),
    ...(source ? { source } : {}),
  })

  const segments = useMemo(
    () => buildSegments(events.data?.items ?? []),
    [events.data],
  )

  const toggleFold = (foldId: string) => {
    setExpandedFolds((current) => {
      const next = new Set(current)
      if (next.has(foldId)) {
        next.delete(foldId)
      } else {
        next.add(foldId)
      }
      return next
    })
  }

  if (events.isLoading) {
    return (
      <div className="animate-pulse">
        <Box height={128} borderRadius="s" backgroundColor="background-card" />
      </div>
    )
  }

  if (events.isError && !events.data) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flex={1}
        padding="2xl"
        borderRadius="s"
        backgroundColor="background-card"
        rowGap="s"
        textAlign="center"
      >
        <Text variant="body" as="h3">
          Couldn&apos;t load events
        </Text>
        <Text color="muted">Something went wrong. Please try again.</Text>
        <Button
          variant="secondary"
          size="sm"
          loading={events.isRefetching}
          onClick={() => events.refetch()}
        >
          Retry
        </Button>
      </Box>
    )
  }

  if (segments.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flex={1}
        padding="2xl"
        borderRadius="s"
        backgroundColor="background-card"
        rowGap="s"
        textAlign="center"
      >
        <Text variant="body" as="h3">
          No events yet
        </Text>
        <Text color="muted">{emptyMessage}</Text>
      </Box>
    )
  }

  return (
    <div className="-mx-3">
      <Box flexDirection="column" rowGap="xs">
        {events.isError && (
          <Box
            alignItems="center"
            justifyContent="between"
            columnGap="m"
            paddingVertical="s"
            paddingHorizontal="m"
            borderRadius="s"
            backgroundColor="background-warning"
          >
            <Text variant="caption" color="warning">
              Couldn&apos;t refresh events. Showing older data.
            </Text>
            <Button
              size="sm"
              variant="ghost"
              loading={events.isRefetching}
              onClick={() => events.refetch()}
            >
              Retry
            </Button>
          </Box>
        )}
        {segments.map((segment) => {
          if (segment.type === 'event') {
            return (
              <TimelineItem
                key={segment.item.event.id}
                event={segment.item.event}
                entry={segment.item.entry}
                organizationSlug={organizationSlug}
              />
            )
          }
          const foldId = segment.items[0].event.id
          const expanded = expandedFolds.has(foldId)
          return (
            <Fragment key={foldId}>
              <TimelineFold
                count={segment.items.length}
                expanded={expanded}
                onToggle={() => toggleFold(foldId)}
              />
              {expanded && (
                <>
                  {segment.items.map((item) => (
                    <TimelineItem
                      key={item.event.id}
                      event={item.event}
                      entry={item.entry}
                      organizationSlug={organizationSlug}
                    />
                  ))}
                  <Box
                    borderBottomWidth={1}
                    borderStyle="solid"
                    borderColor="border-primary"
                    marginVertical="xs"
                  />
                </>
              )}
            </Fragment>
          )
        })}
        {viewAllHref && (
          <Link href={viewAllHref} className="block">
            <Box
              justifyContent="center"
              paddingVertical="s"
              paddingHorizontal="m"
              borderRadius="s"
              backgroundColor={{ hover: 'background-card' }}
              transitionProperty="colors"
              transitionDuration="fast"
            >
              <Text variant="caption" color="muted">
                View all events
              </Text>
            </Box>
          </Link>
        )}
      </Box>
    </div>
  )
}
