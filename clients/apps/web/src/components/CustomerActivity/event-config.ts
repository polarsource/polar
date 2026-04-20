import type { SvgIconComponent } from '@mui/icons-material'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import SpeedOutlined from '@mui/icons-material/SpeedOutlined'
import { schemas } from '@polar-sh/client'

export type TimelineEvent = schemas['Event'] & { name: string }

export type EventTone = 'positive' | 'neutral' | 'warning' | 'danger'

export type SubscriptionPaymentStatus = 'paid' | 'unpaid'

export type TimelineEventContext = {
  event: TimelineEvent
  parentEvent: TimelineEvent | null
  isLinkedOrderPaid: boolean
  subscriptionPaymentStatus: SubscriptionPaymentStatus | null
}

export type ResolvedEventDisplay = {
  icon: SvgIconComponent
  tone: EventTone
  primaryText: string
  description: string | undefined
  groupKey: string
}

type EventMetadata = Record<string, unknown>

type StaticEventConfig = {
  kind: 'static'
  icon: SvgIconComponent
  tone: EventTone
  primaryText: string
  groupSummaryPrefix: string
}

type DynamicEventConfig = {
  kind: 'dynamic'
  icon: SvgIconComponent
  tone: (ctx: TimelineEventContext) => EventTone
  primaryText: (
    ctx: TimelineEventContext,
    productNamesById: Record<string, string>,
  ) => string
  description: (ctx: TimelineEventContext) => string | undefined
  groupKey: (ctx: TimelineEventContext) => string
  groupSummary: (
    events: TimelineEventContext[],
    productNamesById: Record<string, string>,
  ) => string
  tracksSubscriptionPaymentStatus?: boolean
}

type EventConfig = StaticEventConfig | DynamicEventConfig

// ---------------------------------------------------------------------------
// Config map
// ---------------------------------------------------------------------------

const EVENT_CONFIG = {
  'customer.created': staticConfig(
    HistoryOutlined,
    'neutral',
    'Customer created',
    'Customer created',
  ),
  'order.paid': staticConfig(
    ReceiptLongOutlined,
    'positive',
    'Order paid',
    'Order paid',
  ),
  'order.refunded': staticConfig(
    ReceiptLongOutlined,
    'danger',
    'Order refunded',
    'Order refunded',
  ),
  'order.voided': staticConfig(
    ReceiptLongOutlined,
    'danger',
    'Order voided',
    'Order voided',
  ),
  'meter.credited': staticConfig(
    SpeedOutlined,
    'positive',
    'Meter credited',
    'Meter credited',
  ),
  'balance.order': staticConfig(
    ReceiptLongOutlined,
    'neutral',
    'Balance charged',
    'Balance charged',
  ),
  'balance.credit_order': staticConfig(
    ReceiptLongOutlined,
    'positive',
    'Balance credit applied',
    'Balance credits applied',
  ),
  'balance.dispute': staticConfig(
    ReceiptLongOutlined,
    'danger',
    'Balance dispute opened',
    'Balance disputed',
  ),
  'balance.dispute_reversal': staticConfig(
    ReceiptLongOutlined,
    'positive',
    'Balance dispute reversed',
    'Balance dispute reversed',
  ),

  'subscription.created': subscriptionConfig({
    tone: subscriptionPaymentTone,
    description: subscriptionPaymentDescription,
    groupKey: subscriptionPaymentGroupKey,
    primaryText: (ctx, names) =>
      `${subscriptionProductName(ctx.event, names)} subscription started`,
    groupSummary: (events, names) =>
      withPaymentSuffix(
        subscriptionGroupSummary(events, names, 'started'),
        events,
      ),
    tracksSubscriptionPaymentStatus: true,
  }),
  'subscription.canceled': subscriptionConfig({
    tone: () => 'danger',
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: (ctx, names) =>
      `${subscriptionProductName(ctx.event, names)} subscription canceled`,
    groupSummary: (events, names) =>
      subscriptionGroupSummary(events, names, 'canceled'),
  }),
  'subscription.cycled': subscriptionConfig({
    tone: subscriptionPaymentTone,
    description: subscriptionPaymentDescription,
    groupKey: subscriptionPaymentGroupKey,
    primaryText: (ctx, names) =>
      `${subscriptionProductName(ctx.event, names)} renewed`,
    groupSummary: (events, names) =>
      withPaymentSuffix(
        subscriptionGroupSummary(events, names, 'renewed'),
        events,
      ),
    tracksSubscriptionPaymentStatus: true,
  }),
  'subscription.revoked': subscriptionConfig({
    tone: () => 'danger',
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: (ctx, names) =>
      `${subscriptionProductName(ctx.event, names)} revoked`,
    groupSummary: (events) =>
      `Payment issues occurred ${events.length} times${subscriptionScopeSuffix(events)}`,
  }),
  'subscription.uncanceled': subscriptionConfig({
    tone: () => 'positive',
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: (ctx, names) =>
      `${subscriptionProductName(ctx.event, names)} cancellation reversed`,
    groupSummary: (events, names) =>
      subscriptionGroupSummary(events, names, 'cancellation reversed'),
  }),
  'subscription.product_updated': subscriptionConfig({
    tone: () => 'neutral',
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: ({ event }, names) => {
      const nextProductId =
        getMetadataString(event, 'new_product_id') ??
        getMetadataString(event, 'old_product_id')
      const oldProductId = getMetadataString(event, 'old_product_id')
      return `${getProductName(oldProductId, names)} changed to ${getProductName(nextProductId, names)}`
    },
    groupSummary: (events) =>
      `Subscription product changed ${events.length} times${subscriptionScopeSuffix(events)}`,
  }),
  'subscription.seats_updated': subscriptionConfig({
    tone: ({ event }) => {
      const metadata = getMetadata(event)
      const oldSeats = metadata.old_seats
      const newSeats = metadata.new_seats
      if (typeof oldSeats !== 'number' || typeof newSeats !== 'number')
        return 'neutral'
      if (newSeats > oldSeats) return 'positive'
      if (newSeats < oldSeats) return 'warning'
      return 'neutral'
    },
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: ({ event }) => {
      const metadata = getMetadata(event)
      const oldSeats = metadata.old_seats
      const newSeats = metadata.new_seats
      if (typeof oldSeats === 'number' && typeof newSeats === 'number') {
        return `Seats changed from ${oldSeats} to ${newSeats}`
      }
      return 'Seats updated'
    },
    groupSummary: (events) =>
      `Seats updated ${events.length} times${subscriptionScopeSuffix(events)}`,
  }),
  'subscription.billing_period_updated': subscriptionConfig({
    tone: () => 'neutral',
    description: () => undefined,
    groupKey: eventNameGroupKey,
    primaryText: () => 'Billing period updated',
    groupSummary: (events) =>
      `Billing period updated ${events.length} times${subscriptionScopeSuffix(events)}`,
  }),
} as const satisfies Record<string, EventConfig>

export type CustomerActivityTimelineEventName = keyof typeof EVENT_CONFIG

export type CustomerActivityTimelineEventWithPaymentStatusName = {
  [Name in CustomerActivityTimelineEventName]: (typeof EVENT_CONFIG)[Name] extends {
    tracksSubscriptionPaymentStatus: true
  }
    ? Name
    : never
}[CustomerActivityTimelineEventName]

// ---------------------------------------------------------------------------
// Derived sets (replaces constants.ts)
// ---------------------------------------------------------------------------

const eventNames = Object.keys(
  EVENT_CONFIG,
) as CustomerActivityTimelineEventName[]

export const CUSTOMER_ACTIVITY_TIMELINE = {
  EVENT_NAMES: new Set<CustomerActivityTimelineEventName>(eventNames),
  EVENTS_WITH_PAYMENT_STATUS:
    new Set<CustomerActivityTimelineEventWithPaymentStatusName>(
      eventNames.filter(
        (name): name is CustomerActivityTimelineEventWithPaymentStatusName => {
          const config = EVENT_CONFIG[name]
          return (
            config.kind === 'dynamic' &&
            config.tracksSubscriptionPaymentStatus === true
          )
        },
      ),
    ),
} as const

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function resolveEventDisplay(
  context: TimelineEventContext,
  productNamesById: Record<string, string>,
): ResolvedEventDisplay {
  const config = getConfig(context)

  if (config.kind === 'static') {
    return {
      icon: config.icon,
      tone: config.tone,
      primaryText: config.primaryText,
      description: undefined,
      groupKey: context.event.name,
    }
  }

  return {
    icon: config.icon,
    tone: config.tone(context),
    primaryText: config.primaryText(context, productNamesById),
    description: config.description(context),
    groupKey: config.groupKey(context),
  }
}

export function getGroupSummaryText(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  const firstEvent = events[0]
  if (!firstEvent) return ''

  const config = getConfig(firstEvent)

  if (config.kind === 'static') {
    return `${config.groupSummaryPrefix} ${events.length} times`
  }

  return config.groupSummary(events, productNamesById)
}

export function isSubscriptionPaymentStatusEventName(
  eventName: string,
): eventName is CustomerActivityTimelineEventWithPaymentStatusName {
  return CUSTOMER_ACTIVITY_TIMELINE.EVENTS_WITH_PAYMENT_STATUS.has(
    eventName as CustomerActivityTimelineEventWithPaymentStatusName,
  )
}

// ---------------------------------------------------------------------------
// Metadata helpers (used by consumers outside this file)
// ---------------------------------------------------------------------------

export function getMetadata(event: schemas['Event']): EventMetadata {
  return event.metadata as EventMetadata
}

export function getMetadataString(
  event: schemas['Event'],
  key: string,
): string | null {
  const value = getMetadata(event)[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function getProductName(
  productId: string | null,
  productNamesById: Record<string, string>,
): string {
  if (!productId) return 'Plan'
  return productNamesById[productId] ?? 'Plan'
}

export function getPrimaryProductId(event: TimelineEvent): string | null {
  if (event.name === 'subscription.product_updated') {
    return (
      getMetadataString(event, 'new_product_id') ??
      getMetadataString(event, 'old_product_id')
    )
  }
  return getMetadataString(event, 'product_id')
}

export function extractProductIdsFromEvents(
  events: schemas['Event'][],
): string[] {
  const productIds = new Set<string>()

  events.forEach((event) => {
    for (const key of ['product_id', 'old_product_id', 'new_product_id']) {
      const value = getMetadataString(event, key)
      if (value) productIds.add(value)
    }
  })

  return [...productIds]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getConfig(context: TimelineEventContext): EventConfig {
  const config =
    EVENT_CONFIG[context.event.name as CustomerActivityTimelineEventName]
  if (!config) {
    throw new Error(`Unsupported timeline event: ${context.event.name}`)
  }
  return config
}

function staticConfig(
  icon: SvgIconComponent,
  tone: EventTone,
  primaryText: string,
  groupSummaryPrefix: string,
): StaticEventConfig {
  return { kind: 'static', icon, tone, primaryText, groupSummaryPrefix }
}

function subscriptionConfig(
  config: Omit<DynamicEventConfig, 'kind' | 'icon'>,
): DynamicEventConfig {
  return { kind: 'dynamic', icon: AllInclusiveOutlined, ...config }
}

function eventNameGroupKey({ event }: TimelineEventContext): string {
  return event.name
}

function subscriptionPaymentTone({
  subscriptionPaymentStatus,
}: TimelineEventContext): EventTone {
  return subscriptionPaymentStatus === 'unpaid' ? 'warning' : 'positive'
}

function subscriptionPaymentDescription({
  subscriptionPaymentStatus,
}: TimelineEventContext): string | undefined {
  return subscriptionPaymentStatus === 'unpaid' ? 'Not paid' : undefined
}

function subscriptionPaymentGroupKey({
  event,
  subscriptionPaymentStatus,
}: TimelineEventContext): string {
  return `${event.name}:${subscriptionPaymentStatus ?? 'unpaid'}`
}

function subscriptionProductName(
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

function subscriptionGroupSummary(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
  action: string,
): string {
  const subCount = distinctSubscriptionCount(events)
  const occurrences =
    subCount > 1 ? groupedOccurrencesCount(events) : events.length
  const label = subscriptionLabel(events, productNamesById)
  return `${label} ${action}${occurrencesSuffix(occurrences)}`
}

function subscriptionScopeSuffix(events: TimelineEventContext[]): string {
  const count = distinctSubscriptionCount(events)
  return count > 1 ? ` across ${count} subscriptions` : ''
}

function subscriptionLabel(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  const count = distinctSubscriptionCount(events)
  if (count > 1) return `${count} subscriptions`
  return singleSubscriptionLabel(events, productNamesById)
}

function singleSubscriptionLabel(
  events: TimelineEventContext[],
  productNamesById: Record<string, string>,
): string {
  const productNames = new Set<string>()

  events.forEach(({ event }) => {
    const productId = getPrimaryProductId(event)
    if (productId) productNames.add(getProductName(productId, productNamesById))
  })

  return productNames.size === 1
    ? `${[...productNames][0]} subscription`
    : 'Subscription'
}

function subscriptionEventCounts(
  events: TimelineEventContext[],
): Map<string, number> {
  const counts = new Map<string, number>()

  events.forEach(({ event }) => {
    const subscriptionId = getMetadataString(event, 'subscription_id')
    if (!subscriptionId) return
    counts.set(subscriptionId, (counts.get(subscriptionId) ?? 0) + 1)
  })

  return counts
}

function distinctSubscriptionCount(events: TimelineEventContext[]): number {
  return subscriptionEventCounts(events).size
}

function occurrencesSuffix(count: number): string {
  return count > 1 ? ` ${count} times` : ''
}

function groupedOccurrencesCount(events: TimelineEventContext[]): number {
  const eventCounts = [...subscriptionEventCounts(events).values()]
  if (eventCounts.length < 2) return events.length

  const [firstCount, ...remainingCounts] = eventCounts
  return remainingCounts.every((count) => count === firstCount)
    ? firstCount
    : events.length
}
