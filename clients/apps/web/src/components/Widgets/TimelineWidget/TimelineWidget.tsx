'use client'

import { useEvents } from '@/hooks/queries/events'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Fragment, useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { WidgetContainer } from '../WidgetContainer'
import { WidgetGuard } from '../WidgetGuard'
import { resolveTimelineEntry, type TimelineEntry } from './renderers'
import { TimelineFold, TimelineItem } from './TimelineItem'

const WIDGET_TITLE = 'Timeline'
const EVENT_COUNT = 50
const FOLD_THRESHOLD = 1

type SourceFilter = 'system' | 'all'

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
    const item = { event, entry: resolveTimelineEntry(event) }
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

export interface TimelineWidgetProps {
  className?: string
}

export const TimelineWidget = ({ className }: TimelineWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={twMerge('min-h-80', className)}
  >
    <TimelineWidgetContent className={className} />
  </WidgetGuard>
)

const TimelineWidgetContent = ({ className }: TimelineWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)
  const [source, setSource] = useState<SourceFilter>('system')
  const [expandedFolds, setExpandedFolds] = useState<Set<string>>(new Set())

  const events = useEvents(org.id, {
    limit: EVENT_COUNT,
    sorting: ['-timestamp'],
    depth: 0,
    ...(source === 'system' ? { source: 'system' } : {}),
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

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      action={
        <SegmentedControl<SourceFilter>
          size="sm"
          options={[
            { value: 'system', label: 'System' },
            { value: 'all', label: 'All' },
          ]}
          value={source}
          onChange={setSource}
        />
      }
      className={twMerge('min-h-80', className)}
    >
      {events.isLoading ? (
        <div className="animate-pulse">
          <Box
            height={128}
            borderRadius="s"
            backgroundColor="background-card"
          />
        </div>
      ) : segments.length > 0 ? (
        <div className="-mx-3">
          <Box flexDirection="column" rowGap="xs" paddingBottom="xl">
            {segments.map((segment) => {
              if (segment.type === 'event') {
                return (
                  <TimelineItem
                    key={segment.item.event.id}
                    event={segment.item.event}
                    entry={segment.item.entry}
                    organizationSlug={org.slug}
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
                          organizationSlug={org.slug}
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
            <Link
              href={`/dashboard/${org.slug}/analytics/events`}
              className="block"
            >
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
          </Box>
        </div>
      ) : (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          flex={1}
          marginBottom="xl"
          padding="2xl"
          borderRadius="s"
          backgroundColor="background-card"
          rowGap="s"
          textAlign="center"
        >
          <Text variant="body" as="h3">
            No events yet
          </Text>
          <Text color="muted">
            Events from your organization will appear here.
          </Text>
        </Box>
      )}
    </WidgetContainer>
  )
}
