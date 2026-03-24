'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Circle,
  RefreshCw,
  Settings,
  ShoppingCart,
  UserPlus,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export type TimelineEntry =
  | schemas['CustomerCreatedEvent']
  | schemas['OrderPaidEvent']
  | schemas['OrderRefundedEvent']
  | schemas['SubscriptionCreatedEvent']
  | schemas['SubscriptionUpdatedEvent']
  | schemas['SubscriptionCanceledEvent']
  | schemas['SubscriptionRevokedEvent']

const getEntryMeta = (entry: TimelineEntry, organizationSlug: string) => {
  switch (entry.name) {
    case 'order.paid': {
      return {
        icon: <ArrowUpRight className="h-4 w-4" />,
        iconBg:
          'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/${entry.metadata.order_id}`,
      }
    }
    case 'order.refunded': {
      return {
        icon: <ArrowDownLeft className="h-4 w-4" />,
        iconBg:
          'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/${entry.metadata.order_id}`,
      }
    }
    case 'subscription.created': {
      return {
        icon: <ShoppingCart className="h-4 w-4" />,
        iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.metadata.subscription_id}`,
      }
    }
    case 'subscription.updated': {
      return {
        icon: <Settings className="h-4 w-4" />,
        iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.metadata.subscription_id}`,
      }
    }
    case 'subscription.canceled': {
      return {
        icon: <XCircle className="h-4 w-4" />,
        iconBg: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.metadata.subscription_id}`,
      }
    }
    case 'subscription.revoked': {
      return {
        icon: <XCircle className="h-4 w-4" />,
        iconBg: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
        description: entry.label,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.metadata.subscription_id}`,
      }
    }
    case 'customer.created': {
      return {
        icon: <UserPlus className="h-4 w-4" />,
        iconBg:
          'bg-gray-200 text-gray-600 dark:bg-polar-700 dark:text-gray-400',
        description: entry.label,
        href: undefined,
      }
    }
    default:
      return {
        icon: <Circle className="h-4 w-4" />,
        iconBg:
          'bg-gray-200 text-gray-600 dark:bg-polar-700 dark:text-gray-400',
        description: entry.label as string,
        href: undefined,
      }
  }
}

interface TimelineEntryRowProps {
  entry: TimelineEntry
  organizationSlug: string
  compact?: boolean
}

const TimelineEntryRow: React.FC<TimelineEntryRowProps> = ({
  entry,
  organizationSlug,
  compact,
}) => {
  const meta = getEntryMeta(entry, organizationSlug)

  if (!meta) return null

  return (
    <div
      className={twMerge(
        'flex flex-row gap-4',
        compact ? 'items-start' : 'items-center',
      )}
    >
      <div
        className={twMerge(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          meta.iconBg,
        )}
      >
        {meta.icon}
      </div>
      {compact ? (
        <div className="flex flex-1 flex-col text-sm">
          <div className="flex h-8 flex-row items-center gap-x-2">
            {meta.href ? (
              <Link href={meta.href} className="hover:underline">
                {meta.description}
              </Link>
            ) : (
              <span>{meta.description}</span>
            )}
          </div>
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            <FormattedDateTime
              datetime={entry.timestamp}
              dateStyle="medium"
              resolution="time"
            />
          </span>
        </div>
      ) : (
        <div className="flex flex-1 flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-x-4 text-sm">
            {meta.href ? (
              <Link href={meta.href} className="hover:underline">
                {meta.description}
              </Link>
            ) : (
              <span>{meta.description}</span>
            )}
          </div>
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            <FormattedDateTime
              datetime={entry.timestamp}
              dateStyle="medium"
              resolution="time"
            />
          </span>
        </div>
      )}
    </div>
  )
}

interface BaseTimelineViewProps {
  entries: schemas['Event'][]
  organizationSlug: string
}

interface InfiniteTimelineViewProps extends BaseTimelineViewProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

interface CompactTimelineViewProps extends BaseTimelineViewProps {
  compact: true
}

const propsIsCompact = (
  props: CompactTimelineViewProps | InfiniteTimelineViewProps,
): props is CompactTimelineViewProps => 'compact' in props

export const TimelineView: React.FC<
  InfiniteTimelineViewProps | CompactTimelineViewProps
> = (props) => {
  if (props.entries.length === 0) {
    return (
      <p className="dark:text-polar-500 text-sm text-gray-500">
        No activity yet.
      </p>
    )
  }

  if (propsIsCompact(props)) {
    return (
      <div className="flex flex-col gap-y-2">
        {props.entries.map((event) => {
          const entry = event as TimelineEntry
          return (
            <TimelineEntryRow
              key={`${entry.name}-${entry.id}-${entry.timestamp}`}
              entry={entry}
              organizationSlug={props.organizationSlug}
              compact={true}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      {props.entries.map((event) => {
        const entry = event as TimelineEntry
        return (
          <TimelineEntryRow
            key={`${entry.name}-${entry.id}-${entry.timestamp}`}
            entry={entry}
            organizationSlug={props.organizationSlug}
            compact={false}
          />
        )
      })}
      {props.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onLoadMore}
            loading={props.isFetchingNextPage}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
