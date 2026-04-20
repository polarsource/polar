import type { SvgIconComponent } from '@mui/icons-material'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import { schemas } from '@polar-sh/client'
import {
  TimelineGroupEntry,
  TimelineItem,
  TimelineSection,
} from '../Timeline/types'
import { CustomerActivityTimelineEventIcon } from './CustomerActivityTimelineEventIcon'

const dateHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const PAYMENT_WINDOW_MS = 1000 * 60 * 60 * 36
const NON_RECURRING_BILLING_TYPES = new Set(['purchase', 'one_time'])

type EventMetadata = Record<string, unknown>

type BuildTimelineOptions = {
  sortedEvents: schemas['Event'][]
  productNamesById?: Record<string, string>
}

export type TimelineEvent = schemas['Event'] & {
  name: string
}

export type EventTone = 'positive' | 'neutral' | 'warning' | 'danger'

export type SubscriptionPaymentStatus = 'paid' | 'unpaid'

export type TimelineEventContext = {
  event: TimelineEvent
  parentEvent: TimelineEvent | null
  isLinkedOrderPaid: boolean
  subscriptionPaymentStatus: SubscriptionPaymentStatus | null
}

type EventDisplayConfig = {
  icon: SvgIconComponent
  tone: (context: TimelineEventContext) => EventTone
  description: (context: TimelineEventContext) => string | undefined
  groupKey: (context: TimelineEventContext) => string
  primaryText: (
    context: TimelineEventContext,
    productNamesById: Record<string, string>,
  ) => string
  groupSummary: (
    events: TimelineEventContext[],
    productNamesById: Record<string, string>,
  ) => string
}

export type CustomerActivityTimelineEventConfig = EventDisplayConfig & {
  tracksSubscriptionPaymentStatus?: boolean
}

export type SubscriptionPaymentResolution = {
  statusesByEventId: Record<string, SubscriptionPaymentStatus>
  linkedOrderPaidEventIds: Set<string>
}

export function buildCustomerActivityTimeline({
  sortedEvents,
  productNamesById = {},
}: BuildTimelineOptions): TimelineSection[] {
  const timelineItems = buildTimelineItems({
    sortedEvents,
    productNamesById,
  })

  return groupTimelineItemsByDate(timelineItems)
}

export function buildTimelineItems({
  sortedEvents,
  productNamesById = {},
}: BuildTimelineOptions): TimelineItem[] {
  const timelineEvents = sortedEvents as TimelineEvent[]
  const timelineContexts = addContextToEvents(timelineEvents)
  const displayContexts = timelineContexts.filter(shouldDisplayEvent)

  return buildTimelineStream(displayContexts, productNamesById)
}

export const getMetadata = (event: schemas['Event']): EventMetadata => {
  return event.metadata as EventMetadata
}

export const getMetadataString = (
  event: schemas['Event'],
  key: string,
): string | null => {
  const value = getMetadata(event)[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export const getProductName = (
  productId: string | null,
  productNamesById: Record<string, string>,
): string => {
  if (!productId) {
    return 'Plan'
  }

  return productNamesById[productId] ?? 'Plan'
}

export const getPrimaryProductId = (event: TimelineEvent): string | null => {
  if (event.name === 'subscription.product_updated') {
    return (
      getMetadataString(event, 'new_product_id') ??
      getMetadataString(event, 'old_product_id')
    )
  }

  return getMetadataString(event, 'product_id')
}

export const extractProductIdsFromEvents = (
  events: schemas['Event'][],
): string[] => {
  const productIds = new Set<string>()

  events.forEach((event) => {
    ;['product_id', 'old_product_id', 'new_product_id'].forEach((key) => {
      const value = getMetadataString(event, key)
      if (value) {
        productIds.add(value)
      }
    })
  })

  return [...productIds]
}

export function getGroupKey(context: TimelineEventContext): string {
  return getEventDisplayConfig(context).groupKey(context)
}

export function getEventTone(context: TimelineEventContext): EventTone {
  return getEventDisplayConfig(context).tone(context)
}

export function getEventIconComponent(
  context: TimelineEventContext,
): SvgIconComponent {
  return getEventDisplayConfig(context).icon
}

export function getEventPrimaryText(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  return getEventDisplayConfig(context).primaryText(context, productNamesById)
}

export function getEventDescription(
  context: TimelineEventContext,
): string | undefined {
  return getEventDisplayConfig(context).description(context)
}

export function getGroupSummaryText(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  const firstEvent = events[0]
  if (!firstEvent) {
    return ''
  }

  return getEventDisplayConfig(firstEvent).groupSummary(
    events,
    productNamesById,
  )
}

export function buildSubscriptionPaymentResolution(
  allEvents: schemas['Event'][],
): SubscriptionPaymentResolution {
  const { paidLifecycleEventIds, linkedOrderPaidEventIds } =
    collectPaidLifecycleEventLinks(allEvents)

  return {
    statusesByEventId: mapSubscriptionLifecycleStatuses(
      allEvents,
      paidLifecycleEventIds,
    ),
    linkedOrderPaidEventIds,
  }
}

export function buildSubscriptionPaymentStatusByEventId(
  allEvents: schemas['Event'][],
): Record<string, SubscriptionPaymentStatus> {
  return buildSubscriptionPaymentResolution(allEvents).statusesByEventId
}

const customerActivityTimelineEventsConfig = {
  'customer.created': createStaticEventConfig(
    HistoryOutlined,
    'neutral',
    'Customer created',
    'Customer created',
  ),
  'order.paid': createStaticEventConfig(
    ReceiptLongOutlined,
    'positive',
    'Order paid',
    'Order paid',
  ),
  'order.refunded': createStaticEventConfig(
    ReceiptLongOutlined,
    'danger',
    'Order refunded',
    'Order refunded',
  ),
  'order.voided': createStaticEventConfig(
    ReceiptLongOutlined,
    'danger',
    'Order voided',
    'Order voided',
  ),
  'meter.credited': createStaticEventConfig(
    SpeedOutlined,
    'positive',
    'Meter credited',
    'Meter credited',
  ),
  'balance.order': createStaticEventConfig(
    ReceiptLongOutlined,
    'neutral',
    'Balance charged',
    'Balance charged',
  ),
  'balance.credit_order': createStaticEventConfig(
    ReceiptLongOutlined,
    'positive',
    'Balance credit applied',
    'Balance credits applied',
  ),
  'balance.dispute': createStaticEventConfig(
    ReceiptLongOutlined,
    'danger',
    'Balance dispute opened',
    'Balance disputed',
  ),
  'balance.dispute_reversal': createStaticEventConfig(
    ReceiptLongOutlined,
    'positive',
    'Balance dispute reversed',
    'Balance dispute reversed',
  ),
  'subscription.created': createSubscriptionEventConfig({
    tone: getSubscriptionPaymentTone,
    description: getSubscriptionPaymentDescription,
    groupKey: getSubscriptionPaymentGroupKey,
    primaryText: getSubscriptionStartedPrimaryText,
    groupSummary: getSubscriptionStartedGroupSummary,
    tracksSubscriptionPaymentStatus: true,
  }),
  'subscription.canceled': createSubscriptionEventConfig({
    tone: getDangerTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionCanceledPrimaryText,
    groupSummary: getSubscriptionCanceledGroupSummary,
  }),
  'subscription.cycled': createSubscriptionEventConfig({
    tone: getSubscriptionPaymentTone,
    description: getSubscriptionPaymentDescription,
    groupKey: getSubscriptionPaymentGroupKey,
    primaryText: getSubscriptionRenewedPrimaryText,
    groupSummary: getSubscriptionRenewedGroupSummary,
    tracksSubscriptionPaymentStatus: true,
  }),
  'subscription.revoked': createSubscriptionEventConfig({
    tone: getDangerTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionRevokedPrimaryText,
    groupSummary: getSubscriptionRevokedGroupSummary,
  }),
  'subscription.uncanceled': createSubscriptionEventConfig({
    tone: getPositiveTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionUncanceledPrimaryText,
    groupSummary: getSubscriptionUncanceledGroupSummary,
  }),
  'subscription.product_updated': createSubscriptionEventConfig({
    tone: getNeutralTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionProductUpdatedPrimaryText,
    groupSummary: getSubscriptionProductUpdatedGroupSummary,
  }),
  'subscription.seats_updated': createSubscriptionEventConfig({
    tone: getSubscriptionSeatsUpdatedTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionSeatsUpdatedPrimaryText,
    groupSummary: getSubscriptionSeatsUpdatedGroupSummary,
  }),
  'subscription.billing_period_updated': createSubscriptionEventConfig({
    tone: getNeutralTone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: getSubscriptionBillingPeriodUpdatedPrimaryText,
    groupSummary: getSubscriptionBillingPeriodUpdatedGroupSummary,
  }),
} as const satisfies Record<string, CustomerActivityTimelineEventConfig>

export type CustomerActivityTimelineEventName =
  keyof typeof customerActivityTimelineEventsConfig

export type CustomerActivityTimelineEventWithPaymentStatusName = {
  [Name in CustomerActivityTimelineEventName]: (typeof customerActivityTimelineEventsConfig)[Name] extends {
    tracksSubscriptionPaymentStatus: true
  }
    ? Name
    : never
}[CustomerActivityTimelineEventName]

export const CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG: Record<
  CustomerActivityTimelineEventName,
  CustomerActivityTimelineEventConfig
> = customerActivityTimelineEventsConfig

function addContextToEvents(events: TimelineEvent[]): TimelineEventContext[] {
  const eventById = new Map(events.map((event) => [event.id, event]))
  const { statusesByEventId, linkedOrderPaidEventIds } =
    buildSubscriptionPaymentResolution(events)

  return events.map((event) => {
    const parentEvent = event.parent_id ? eventById.get(event.parent_id) : null

    return {
      event,
      parentEvent: parentEvent ?? null,
      isLinkedOrderPaid: linkedOrderPaidEventIds.has(event.id),
      subscriptionPaymentStatus: statusesByEventId[event.id] ?? null,
    }
  })
}

function shouldDisplayEvent(context: TimelineEventContext): boolean {
  return context.event.name !== 'order.paid' || !context.isLinkedOrderPaid
}

function buildTimelineStream(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): TimelineItem[] {
  const timelineItems: TimelineItem[] = []

  for (let index = 0; index < events.length; ) {
    const groupedEvents = getConsecutiveGroupedEvents(events, index)

    if (groupedEvents.length < 2) {
      timelineItems.push(
        createTimelineEventItem(groupedEvents[0], productNamesById),
      )
      index += 1
      continue
    }

    timelineItems.push(createTimelineGroupItem(groupedEvents, productNamesById))
    index += groupedEvents.length
  }

  return timelineItems
}

function getConsecutiveGroupedEvents(
  events: TimelineEventContext[],
  startIndex: number,
): TimelineEventContext[] {
  const firstEvent = events[startIndex]
  const groupKey = getGroupKey(firstEvent)
  const groupedEvents: TimelineEventContext[] = [firstEvent]

  let nextIndex = startIndex + 1
  while (nextIndex < events.length) {
    const nextEvent = events[nextIndex]

    if (getGroupKey(nextEvent) !== groupKey) {
      break
    }

    groupedEvents.push(nextEvent)
    nextIndex += 1
  }

  return groupedEvents
}

function createTimelineGroupItem(
  groupedEvents: TimelineEventContext[],
  productNamesById: Record<string, string>,
): Extract<TimelineItem, { kind: 'group' }> {
  const firstEvent = groupedEvents[0]
  const groupKey = getGroupKey(firstEvent)

  return {
    kind: 'group',
    id: `group:${groupKey}:${firstEvent.event.id}`,
    icon: <CustomerActivityTimelineEventIcon event={firstEvent} />,
    timestamp: {
      start: firstEvent.event.timestamp,
      end: groupedEvents[groupedEvents.length - 1].event.timestamp,
    },
    title: getGroupSummaryText(groupedEvents, productNamesById),
    items: groupedEvents.map((event) =>
      toTimelineGroupEntry(event, productNamesById),
    ),
  }
}

function createTimelineEventItem(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): Extract<TimelineItem, { kind: 'event' }> {
  return {
    kind: 'event',
    id: context.event.id,
    timestamp: context.event.timestamp,
    icon: <CustomerActivityTimelineEventIcon event={context} />,
    title: getEventPrimaryText(context, productNamesById),
    description: getEventDescription(context),
  }
}

function toTimelineGroupEntry(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): TimelineGroupEntry {
  return {
    id: context.event.id,
    title: getEventPrimaryText(context, productNamesById),
    description: getEventDescription(context),
    timestamp: context.event.timestamp,
  }
}

function groupTimelineItemsByDate(
  timelineItems: TimelineItem[],
): TimelineSection[] {
  const sections = new Map<string, TimelineSection>()

  timelineItems.forEach((item) => {
    const date = getTimelineItemDate(item)

    if (!date) {
      addUnknownDateTimelineItem(sections, item)
      return
    }

    addTimelineItemToDateSection(sections, item, date)
  })

  return [...sections.values()]
}

function addUnknownDateTimelineItem(
  sections: Map<string, TimelineSection>,
  item: TimelineItem,
): void {
  const fallbackKey = 'unknown-date'
  const fallbackSection = sections.get(fallbackKey)

  if (fallbackSection) {
    fallbackSection.items.push(item)
    return
  }

  sections.set(fallbackKey, {
    formattedDate: 'Unknown date',
    items: [item],
  })
}

function addTimelineItemToDateSection(
  sections: Map<string, TimelineSection>,
  item: TimelineItem,
  date: Date,
): void {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const existingSection = sections.get(dateKey)

  if (existingSection) {
    existingSection.items.push(item)
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
    const parsedDate = new Date(timestamp)

    if (!Number.isFinite(parsedDate.getTime())) {
      return
    }

    if (!latestDate || parsedDate.getTime() > latestDate.getTime()) {
      latestDate = parsedDate
    }
  })

  return latestDate
}

function getEventDisplayConfig(context: TimelineEventContext) {
  const eventName = context.event
    .name as keyof typeof CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG
  const config = CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG[eventName]

  if (!config) {
    throw new Error(`Unsupported timeline event: ${context.event.name}`)
  }

  return config
}

function createSubscriptionEventConfig(
  config: Omit<CustomerActivityTimelineEventConfig, 'icon'>,
): CustomerActivityTimelineEventConfig {
  return {
    icon: AllInclusiveOutlined,
    ...config,
  }
}

function createStaticEventConfig(
  icon: SvgIconComponent,
  tone: EventTone,
  primaryText: string,
  groupSummaryPrefix: string,
): CustomerActivityTimelineEventConfig {
  return {
    icon,
    tone: () => tone,
    description: getNoDescription,
    groupKey: getEventNameGroupKey,
    primaryText: () => primaryText,
    groupSummary: createStaticGroupSummary(groupSummaryPrefix),
  }
}

function getNoDescription(): undefined {
  return undefined
}

function getEventNameGroupKey({ event }: TimelineEventContext): string {
  return event.name
}

function getPositiveTone(): EventTone {
  return 'positive'
}

function getNeutralTone(): EventTone {
  return 'neutral'
}

function getDangerTone(): EventTone {
  return 'danger'
}

function getSubscriptionPaymentDescription({
  subscriptionPaymentStatus,
}: TimelineEventContext): string | undefined {
  return subscriptionPaymentStatus === 'unpaid' ? 'Not paid' : undefined
}

function getSubscriptionPaymentTone({
  subscriptionPaymentStatus,
}: TimelineEventContext): EventTone {
  return subscriptionPaymentStatus === 'unpaid' ? 'warning' : 'positive'
}

function getSubscriptionPaymentGroupKey({
  event,
  subscriptionPaymentStatus,
}: TimelineEventContext): string {
  return `${event.name}:${subscriptionPaymentStatus ?? 'unpaid'}`
}

function getSubscriptionStartedPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const productName = getSubscriptionProductName(event, productNamesById)
  return `${productName} subscription started`
}

function getSubscriptionCanceledPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const productName = getSubscriptionProductName(event, productNamesById)
  return `${productName} subscription canceled`
}

function getSubscriptionRenewedPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const productName = getSubscriptionProductName(event, productNamesById)
  return `${productName} renewed`
}

function getSubscriptionRevokedPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const productName = getSubscriptionProductName(event, productNamesById)
  return `${productName} revoked`
}

function getSubscriptionUncanceledPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const productName = getSubscriptionProductName(event, productNamesById)
  return `${productName} cancellation reversed`
}

function getSubscriptionProductUpdatedPrimaryText(
  { event }: TimelineEventContext,
  productNamesById: Record<string, string>,
): string {
  const nextProductId =
    getMetadataString(event, 'new_product_id') ??
    getMetadataString(event, 'old_product_id')
  const oldProductId = getMetadataString(event, 'old_product_id')
  const nextProduct = getProductName(nextProductId, productNamesById)
  const previousProduct = getProductName(oldProductId, productNamesById)

  return `${previousProduct} changed to ${nextProduct}`
}

function getSubscriptionSeatsUpdatedPrimaryText({
  event,
}: TimelineEventContext): string {
  const metadata = getMetadata(event)
  const oldSeats = metadata.old_seats
  const newSeats = metadata.new_seats

  if (typeof oldSeats === 'number' && typeof newSeats === 'number') {
    return `Seats changed from ${oldSeats} to ${newSeats}`
  }

  return 'Seats updated'
}

function getSubscriptionBillingPeriodUpdatedPrimaryText(): string {
  return 'Billing period updated'
}

function getSubscriptionStartedGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  return withPaymentSuffix(
    getSubscriptionGroupSummary(events, productNamesById, 'started'),
    events,
  )
}

function getSubscriptionCanceledGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  return getSubscriptionGroupSummary(events, productNamesById, 'canceled')
}

function getSubscriptionRenewedGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  return withPaymentSuffix(
    getSubscriptionGroupSummary(events, productNamesById, 'renewed'),
    events,
  )
}

function getSubscriptionRevokedGroupSummary(
  events: TimelineEventContext[],
): string {
  return `Payment issues occurred ${events.length} times${getSubscriptionScopeSuffix(events)}`
}

function getSubscriptionUncanceledGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  return getSubscriptionGroupSummary(
    events,
    productNamesById,
    'cancellation reversed',
  )
}

function getSubscriptionProductUpdatedGroupSummary(
  events: TimelineEventContext[],
): string {
  return `Subscription product changed ${events.length} times${getSubscriptionScopeSuffix(events)}`
}

function getSubscriptionSeatsUpdatedGroupSummary(
  events: TimelineEventContext[],
): string {
  return `Seats updated ${events.length} times${getSubscriptionScopeSuffix(events)}`
}

function getSubscriptionBillingPeriodUpdatedGroupSummary(
  events: TimelineEventContext[],
): string {
  return `Billing period updated ${events.length} times${getSubscriptionScopeSuffix(events)}`
}

function getSubscriptionSeatsUpdatedTone({
  event,
}: TimelineEventContext): EventTone {
  const metadata = getMetadata(event)
  const oldSeats = metadata.old_seats
  const newSeats = metadata.new_seats

  if (typeof oldSeats !== 'number' || typeof newSeats !== 'number') {
    return 'neutral'
  }

  if (newSeats > oldSeats) {
    return 'positive'
  }

  if (newSeats < oldSeats) {
    return 'warning'
  }

  return 'neutral'
}

function createStaticGroupSummary(prefix: string) {
  return (events: TimelineEventContext[]) => `${prefix} ${events.length} times`
}

function getSubscriptionProductName(
  event: TimelineEventContext['event'],
  productNamesById: Record<string, string>,
): string {
  return getProductName(getPrimaryProductId(event), productNamesById)
}

function withPaymentSuffix(
  baseText: string,
  events: TimelineEventContext[],
): string {
  return events[0]?.subscriptionPaymentStatus === 'unpaid'
    ? `${baseText} (not paid)`
    : baseText
}

const getSingleSubscriptionLabel = (
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string => {
  const productNames = new Set<string>()

  events.forEach(({ event }) => {
    const productId = getPrimaryProductId(event)
    if (!productId) {
      return
    }

    productNames.add(getProductName(productId, productNamesById))
  })

  return productNames.size === 1
    ? `${[...productNames][0]} subscription`
    : 'Subscription'
}

const getSubscriptionEventCounts = (
  events: TimelineEventContext[],
): Map<string, number> => {
  const counts = new Map<string, number>()

  events.forEach(({ event }) => {
    const subscriptionId = getMetadataString(event, 'subscription_id')
    if (!subscriptionId) {
      return
    }

    counts.set(subscriptionId, (counts.get(subscriptionId) ?? 0) + 1)
  })

  return counts
}

const getDistinctSubscriptionCount = (
  events: TimelineEventContext[],
): number => {
  return getSubscriptionEventCounts(events).size
}

const getOccurrencesSuffix = (count: number): string => {
  return count > 1 ? ` ${count} times` : ''
}

const getGroupedOccurrencesCount = (events: TimelineEventContext[]): number => {
  const eventCounts = [...getSubscriptionEventCounts(events).values()]

  if (eventCounts.length < 2) {
    return events.length
  }

  const [firstCount, ...remainingCounts] = eventCounts
  return remainingCounts.every((count) => count === firstCount)
    ? firstCount
    : events.length
}

const getSubscriptionLabel = (
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string => {
  const subscriptionCount = getDistinctSubscriptionCount(events)

  if (subscriptionCount > 1) {
    return `${subscriptionCount} subscriptions`
  }

  return getSingleSubscriptionLabel(events, productNamesById)
}

function getSubscriptionGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
  action: string,
): string {
  const subscriptionCount = getDistinctSubscriptionCount(events)
  const occurrences =
    subscriptionCount > 1 ? getGroupedOccurrencesCount(events) : events.length
  const subscriptionLabel = getSubscriptionLabel(events, productNamesById)

  return `${subscriptionLabel} ${action}${getOccurrencesSuffix(occurrences)}`
}

function getSubscriptionScopeSuffix(events: TimelineEventContext[]): string {
  const subscriptionCount = getDistinctSubscriptionCount(events)
  return subscriptionCount > 1
    ? ` across ${subscriptionCount} subscriptions`
    : ''
}

type SubscriptionPaymentLifecycleEvent = schemas['Event'] & {
  name: CustomerActivityTimelineEventWithPaymentStatusName
}

type PaidLifecycleEventLinks = {
  paidLifecycleEventIds: Set<string>
  linkedOrderPaidEventIds: Set<string>
}

function collectPaidLifecycleEventLinks(
  allEvents: schemas['Event'][],
): PaidLifecycleEventLinks {
  const eventById = new Map(allEvents.map((event) => [event.id, event]))
  const lifecycleBySubscription = createLifecycleBySubscriptionMap(allEvents)
  const paidLifecycleEventIds = new Set<string>()
  const linkedOrderPaidEventIds = new Set<string>()

  allEvents.forEach((event) => {
    if (!isOrderPaidEvent(event) || isNonRecurringOrderPayment(event)) {
      return
    }

    const lifecycleEvent = resolvePaidLifecycleEvent(
      event,
      eventById,
      lifecycleBySubscription,
    )

    if (!lifecycleEvent) {
      return
    }

    paidLifecycleEventIds.add(lifecycleEvent.id)
    linkedOrderPaidEventIds.add(event.id)
  })

  return {
    paidLifecycleEventIds,
    linkedOrderPaidEventIds,
  }
}

function mapSubscriptionLifecycleStatuses(
  allEvents: schemas['Event'][],
  paidLifecycleEventIds: Set<string>,
): Record<string, SubscriptionPaymentStatus> {
  return allEvents.reduce<Record<string, SubscriptionPaymentStatus>>(
    (statuses, event) => {
      if (!isSubscriptionPaymentLifecycleEvent(event)) {
        return statuses
      }

      statuses[event.id] = paidLifecycleEventIds.has(event.id)
        ? 'paid'
        : 'unpaid'
      return statuses
    },
    {},
  )
}

function resolvePaidLifecycleEvent(
  paymentEvent: schemas['Event'],
  eventById: Map<string, schemas['Event']>,
  lifecycleBySubscription: Map<string, SubscriptionPaymentLifecycleEvent[]>,
): SubscriptionPaymentLifecycleEvent | null {
  const lifecycleAncestor = findLifecycleAncestor(
    paymentEvent,
    eventById,
    lifecycleBySubscription,
  )

  if (lifecycleAncestor) {
    return lifecycleAncestor
  }

  return findClosestLifecycleBySubscriptionAndTime(
    paymentEvent,
    lifecycleBySubscription,
  )
}

function findLifecycleAncestor(
  event: schemas['Event'],
  eventById: Map<string, schemas['Event']>,
  lifecycleBySubscription: Map<string, SubscriptionPaymentLifecycleEvent[]>,
): SubscriptionPaymentLifecycleEvent | null {
  let parentId = event.parent_id

  while (parentId) {
    const parent = eventById.get(parentId)
    if (!parent) {
      return null
    }

    if (isSubscriptionPaymentLifecycleEvent(parent)) {
      return parent
    }

    const lifecycleMatch = findClosestLifecycleBySubscriptionAndTime(
      parent,
      lifecycleBySubscription,
    )
    if (lifecycleMatch) {
      return lifecycleMatch
    }

    parentId = parent.parent_id
  }

  return null
}

function findClosestLifecycleBySubscriptionAndTime(
  event: schemas['Event'],
  lifecycleBySubscription: Map<string, SubscriptionPaymentLifecycleEvent[]>,
): SubscriptionPaymentLifecycleEvent | null {
  if (isNonRecurringOrderPayment(event)) {
    return null
  }

  const subscriptionId = getMetadataString(event, 'subscription_id')
  if (!subscriptionId) {
    return null
  }

  const candidates = lifecycleBySubscription.get(subscriptionId)
  if (!candidates || candidates.length === 0) {
    return null
  }

  let closestLifecycle: SubscriptionPaymentLifecycleEvent | null = null
  let smallestDistance = Number.POSITIVE_INFINITY

  candidates.forEach((candidate) => {
    if (!isWithinPaymentWindow(candidate.timestamp, event.timestamp)) {
      return
    }

    const distance = Math.abs(
      new Date(candidate.timestamp).getTime() -
        new Date(event.timestamp).getTime(),
    )

    if (distance < smallestDistance) {
      smallestDistance = distance
      closestLifecycle = candidate
    }
  })

  return closestLifecycle
}

function createLifecycleBySubscriptionMap(
  events: schemas['Event'][],
): Map<string, SubscriptionPaymentLifecycleEvent[]> {
  const map = new Map<string, SubscriptionPaymentLifecycleEvent[]>()

  events.forEach((event) => {
    if (!isSubscriptionPaymentLifecycleEvent(event)) {
      return
    }

    const subscriptionId = getMetadataString(event, 'subscription_id')
    if (!subscriptionId) {
      return
    }

    const existing = map.get(subscriptionId)
    if (existing) {
      existing.push(event)
      return
    }

    map.set(subscriptionId, [event])
  })

  return map
}

function isSubscriptionPaymentLifecycleEvent(
  event: schemas['Event'],
): event is SubscriptionPaymentLifecycleEvent {
  return isSubscriptionPaymentStatusEventName(event.name)
}

function isSubscriptionPaymentStatusEventName(
  eventName: string,
): eventName is CustomerActivityTimelineEventWithPaymentStatusName {
  const config =
    CUSTOMER_ACTIVITY_TIMELINE_EVENTS_CONFIG[
      eventName as CustomerActivityTimelineEventName
    ]

  return config?.tracksSubscriptionPaymentStatus === true
}

function isNonRecurringOrderPayment(event: schemas['Event']): boolean {
  if (!isOrderPaidEvent(event)) {
    return false
  }

  const billingType = (event.metadata as Record<string, unknown>).billing_type

  return (
    typeof billingType === 'string' &&
    NON_RECURRING_BILLING_TYPES.has(billingType)
  )
}

function isOrderPaidEvent(event: schemas['Event']): boolean {
  return event.name === 'order.paid'
}

function isWithinPaymentWindow(
  firstTimestamp: string,
  secondTimestamp: string,
): boolean {
  return (
    Math.abs(
      new Date(firstTimestamp).getTime() - new Date(secondTimestamp).getTime(),
    ) <= PAYMENT_WINDOW_MS
  )
}
