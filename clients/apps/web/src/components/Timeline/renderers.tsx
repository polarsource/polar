import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import AttachMoneyOutlined from '@mui/icons-material/AttachMoneyOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import { benefitsDisplayNames } from '@/components/Benefit/utils'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import type { ReactNode } from 'react'

export type TimelineImportance = 'high' | 'medium' | 'low'

export type TimelineSentiment = 'neutral' | 'negative'

export interface TimelineEntry {
  importance: TimelineImportance
  title: string
  icon: ReactNode
  summary?: ReactNode
  sentiment?: TimelineSentiment
}

type SystemEventName = schemas['SystemEvent']['name']
type SystemEventByName<N extends SystemEventName> = Extract<
  schemas['SystemEvent'],
  { name: N }
>

interface TimelineRenderer<N extends SystemEventName> {
  importance: TimelineImportance
  summary?: (event: SystemEventByName<N>) => ReactNode
  sentiment?: TimelineSentiment
}

type TimelineRendererMap = {
  [N in SystemEventName]: TimelineRenderer<N> | null
}

const currency = formatCurrency('standard')

const humanize = (value: string): string =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

const recurringPrice = (
  amount: number,
  currencyCode: string,
  interval?: string,
  intervalCount?: number,
): string => {
  const price = currency(amount, currencyCode)
  if (!interval) {
    return price
  }
  const cadence =
    intervalCount && intervalCount > 1
      ? `every ${intervalCount} ${interval}s`
      : `per ${interval}`
  return `${price} ${cadence}`
}

const timelineRenderers: TimelineRendererMap = {
  'subscription.created': {
    importance: 'high',
    summary: ({ metadata }) =>
      recurringPrice(
        metadata.amount,
        metadata.currency,
        metadata.recurring_interval,
        metadata.recurring_interval_count,
      ),
  },
  'subscription.cycled': {
    importance: 'medium',
    summary: ({ metadata }) =>
      metadata.amount !== undefined && metadata.currency
        ? currency(metadata.amount, metadata.currency)
        : undefined,
  },
  'subscription.updated': { importance: 'medium' },
  'subscription.product_updated': { importance: 'medium' },
  'subscription.seats_updated': {
    importance: 'medium',
    summary: ({ metadata }) =>
      `${metadata.old_seats} → ${metadata.new_seats} seats`,
  },
  'subscription.billing_period_updated': { importance: 'low' },
  'subscription.update_cleared': { importance: 'low' },
  'subscription.uncanceled': { importance: 'high' },
  'subscription.reactivated': { importance: 'high' },
  'subscription.reinstated': { importance: 'high' },
  'subscription.resumed': { importance: 'medium' },
  'subscription.paused': { importance: 'medium', sentiment: 'negative' },
  'subscription.canceled': {
    importance: 'high',
    sentiment: 'negative',
    summary: ({ metadata }) =>
      metadata.customer_cancellation_reason
        ? humanize(metadata.customer_cancellation_reason)
        : undefined,
  },
  'subscription.revoked': { importance: 'high', sentiment: 'negative' },
  'subscription.past_due': { importance: 'high', sentiment: 'negative' },
  'order.paid': {
    importance: 'high',
    summary: ({ metadata }) =>
      currency(metadata.amount, metadata.currency ?? 'usd'),
  },
  'order.refunded': {
    importance: 'high',
    sentiment: 'negative',
    summary: ({ metadata }) =>
      currency(metadata.refunded_amount, metadata.currency),
  },
  'order.voided': {
    importance: 'high',
    sentiment: 'negative',
    summary: ({ metadata }) => currency(metadata.amount, metadata.currency),
  },
  'order.unvoided': {
    importance: 'medium',
    summary: ({ metadata }) => currency(metadata.amount, metadata.currency),
  },
  'checkout.created': {
    importance: 'low',
    summary: ({ metadata }) => humanize(metadata.checkout_status),
  },
  'customer.created': {
    importance: 'medium',
    summary: ({ metadata }) =>
      metadata.customer_name || metadata.customer_email || undefined,
  },
  'customer.updated': { importance: 'low' },
  'customer.deleted': {
    importance: 'medium',
    sentiment: 'negative',
    summary: ({ metadata }) =>
      metadata.customer_name || metadata.customer_email || undefined,
  },
  'benefit.granted': {
    importance: 'medium',
    summary: ({ metadata }) => benefitsDisplayNames[metadata.benefit_type],
  },
  'benefit.revoked': {
    importance: 'medium',
    sentiment: 'negative',
    summary: ({ metadata }) => benefitsDisplayNames[metadata.benefit_type],
  },
  'benefit.cycled': {
    importance: 'low',
    summary: ({ metadata }) => benefitsDisplayNames[metadata.benefit_type],
  },
  'benefit.updated': {
    importance: 'low',
    summary: ({ metadata }) => benefitsDisplayNames[metadata.benefit_type],
  },
  'balance.order': null,
  'balance.credit_order': null,
  'balance.refund': null,
  'balance.refund_reversal': null,
  'balance.dispute': null,
  'balance.dispute_reversal': null,
  'meter.credited': {
    importance: 'low',
    summary: ({ metadata }) =>
      `${metadata.units.toLocaleString()} ${metadata.units === 1 ? 'unit' : 'units'}`,
  },
  'meter.reset': { importance: 'low' },
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  subscription: <AllInclusiveOutlined fontSize="inherit" />,
  order: <ShoppingBagOutlined fontSize="inherit" />,
  checkout: <ShoppingCartOutlined fontSize="inherit" />,
  customer: <PersonOutlineOutlined fontSize="inherit" />,
  benefit: <DiamondOutlined fontSize="inherit" />,
  balance: <AttachMoneyOutlined fontSize="inherit" />,
  meter: <DonutLargeOutlined fontSize="inherit" />,
}

const USER_EVENT_ICON = <BoltOutlined fontSize="inherit" />

const resolveTimelineIcon = (event: schemas['Event']): ReactNode => {
  if (event.source === 'user') {
    return USER_EVENT_ICON
  }
  return CATEGORY_ICONS[event.name.split('.')[0]] ?? USER_EVENT_ICON
}

export const resolveTimelineEntry = (
  event: schemas['Event'],
): TimelineEntry | null => {
  const icon = resolveTimelineIcon(event)

  if (event.source === 'user') {
    return {
      importance: 'medium',
      title: event.label,
      icon,
    }
  }

  const renderer = timelineRenderers[event.name] as
    | TimelineRenderer<SystemEventName>
    | null
    | undefined

  if (renderer === null) {
    return null
  }

  if (!renderer) {
    return { importance: 'low', title: event.label, icon }
  }

  return {
    importance: renderer.importance,
    title: event.label,
    icon,
    summary: renderer.summary?.(event as never),
    sentiment: renderer.sentiment,
  }
}
