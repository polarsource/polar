import { schemas } from '@polar-sh/client'
import {
  TimelineGroupEntry,
  TimelineItem,
  TimelineSection,
} from '../Timeline/types'
import { CustomerActivityTimelineEventIcon } from './CustomerActivityTimelineEventIcon'
import {
  getGroupSummaryText,
  resolveEventDisplay,
  type TimelineEvent,
  type TimelineEventContext,
} from './event-config'
import { buildSubscriptionPaymentResolution } from './payment-resolution'

const dateHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

type BuildTimelineOptions = {
  events: schemas['Event'][]
  productNamesById?: Record<string, string>
}

export function buildCustomerActivityTimeline({
  events,
  productNamesById = {},
}: BuildTimelineOptions): TimelineSection[] {
  return groupTimelineItemsByDate(
    buildTimelineItems({ events, productNamesById }),
  )
}

export function buildTimelineItems({
  events,
  productNamesById = {},
}: BuildTimelineOptions): TimelineItem[] {
  const contexts = addContextToEvents(events)
  const displayContexts = contexts.filter(shouldDisplayEvent)
  return buildTimelineStream(displayContexts, productNamesById)
}

// ---------------------------------------------------------------------------
// Context enrichment
// ---------------------------------------------------------------------------

function addContextToEvents(events: TimelineEvent[]): TimelineEventContext[] {
  const eventById = new Map(events.map((event) => [event.id, event]))
  const { statusesByEventId, linkedOrderPaidEventIds } =
    buildSubscriptionPaymentResolution(events)

  return events.map((event) => ({
    event,
    parentEvent: event.parent_id
      ? (eventById.get(event.parent_id) ?? null)
      : null,
    isLinkedOrderPaid: linkedOrderPaidEventIds.has(event.id),
    subscriptionPaymentStatus: statusesByEventId[event.id] ?? null,
  }))
}

function shouldDisplayEvent(context: TimelineEventContext): boolean {
  return context.event.name !== 'order.paid' || !context.isLinkedOrderPaid
}

// ---------------------------------------------------------------------------
// Stream → TimelineItem[]
// ---------------------------------------------------------------------------

function buildTimelineStream(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): TimelineItem[] {
  const items: TimelineItem[] = []

  for (let index = 0; index < events.length; ) {
    const grouped = getConsecutiveGroupedEvents(events, index)

    if (grouped.length < 2) {
      items.push(createTimelineEventItem(grouped[0], productNamesById))
      index += 1
      continue
    }

    items.push(createTimelineGroupItem(grouped, productNamesById))
    index += grouped.length
  }

  return items
}

function getConsecutiveGroupedEvents(
  events: TimelineEventContext[],
  startIndex: number,
): TimelineEventContext[] {
  const first = events[startIndex]
  const firstKey = resolveEventDisplay(first, {}).groupKey
  const result: TimelineEventContext[] = [first]

  let nextIndex = startIndex + 1
  while (nextIndex < events.length) {
    const next = events[nextIndex]
    if (resolveEventDisplay(next, {}).groupKey !== firstKey) break
    result.push(next)
    nextIndex += 1
  }

  return result
}

function createTimelineGroupItem(
  groupedEvents: TimelineEventContext[],
  productNamesById: Record<string, string>,
): Extract<TimelineItem, { kind: 'group' }> {
  const first = groupedEvents[0]
  const display = resolveEventDisplay(first, productNamesById)

  return {
    kind: 'group',
    id: `group:${display.groupKey}:${first.event.id}`,
    icon: <CustomerActivityTimelineEventIcon event={first} />,
    timestamp: {
      start: first.event.timestamp,
      end: groupedEvents[groupedEvents.length - 1].event.timestamp,
    },
    title: getGroupSummaryText(groupedEvents, productNamesById),
    items: groupedEvents.map((ctx) =>
      toTimelineGroupEntry(ctx, productNamesById),
    ),
  }
}

function createTimelineEventItem(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): Extract<TimelineItem, { kind: 'event' }> {
  const display = resolveEventDisplay(context, productNamesById)

  return {
    kind: 'event',
    id: context.event.id,
    timestamp: context.event.timestamp,
    icon: <CustomerActivityTimelineEventIcon event={context} />,
    title: display.primaryText,
    description: display.description,
  }
}

function toTimelineGroupEntry(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): TimelineGroupEntry {
  const display = resolveEventDisplay(context, productNamesById)

  return {
    id: context.event.id,
    title: display.primaryText,
    description: display.description,
    timestamp: context.event.timestamp,
  }
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

function groupTimelineItemsByDate(
  timelineItems: TimelineItem[],
): TimelineSection[] {
  const sections = new Map<string, TimelineSection>()

  timelineItems.forEach((item) => {
    const date = getTimelineItemDate(item)

    if (!date) {
      addUnknownDateItem(sections, item)
      return
    }

    addItemToDateSection(sections, item, date)
  })

  return [...sections.values()]
}

function addUnknownDateItem(
  sections: Map<string, TimelineSection>,
  item: TimelineItem,
): void {
  const key = 'unknown-date'
  const existing = sections.get(key)

  if (existing) {
    existing.items.push(item)
    return
  }

  sections.set(key, { formattedDate: 'Unknown date', items: [item] })
}

function addItemToDateSection(
  sections: Map<string, TimelineSection>,
  item: TimelineItem,
  date: Date,
): void {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const existing = sections.get(dateKey)

  if (existing) {
    existing.items.push(item)
    return
  }

  sections.set(dateKey, {
    formattedDate: dateHeadingFormatter.format(date),
    items: [item],
  })
}

function getTimelineItemDate(item: TimelineItem): Date | null {
  if (item.kind === 'group') {
    return getLatestValidDate([item.timestamp.start, item.timestamp.end])
  }
  return getLatestValidDate([item.timestamp])
}

function getLatestValidDate(timestamps: string[]): Date | null {
  let latestDate: Date | null = null

  timestamps.forEach((timestamp) => {
    const parsed = new Date(timestamp)
    if (!Number.isFinite(parsed.getTime())) return
    if (!latestDate || parsed.getTime() > latestDate.getTime()) {
      latestDate = parsed
    }
  })

  return latestDate
}
