'use client'

import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ShoppingCart,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

type TimelineEntry =
  | schemas['OrderTimelineEntry']
  | schemas['RefundTimelineEntry']
  | schemas['SubscriptionStartedTimelineEntry']
  | schemas['SubscriptionCanceledTimelineEntry']

const getEntryMeta = (entry: TimelineEntry, organizationSlug: string) => {
  switch (entry.type) {
    case 'order': {
      const reasonLabels: Record<string, string> = {
        purchase: 'One-time purchase',
        subscription_create: 'Subscription started',
        subscription_cycle: 'Subscription renewed',
        subscription_update: 'Subscription updated',
      }
      const label = reasonLabels[entry.billing_reason] ?? 'Charged'

      return {
        icon: <ArrowUpRight className="h-4 w-4" />,
        iconBg:
          'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
        description: label,
        detail: entry.product_name,
        href: `/dashboard/${organizationSlug}/sales/${entry.id}`,
      }
    }
    case 'refund': {
      const amount = formatCurrency('compact')(entry.amount, entry.currency)
      return {
        icon: <ArrowDownLeft className="h-4 w-4" />,
        iconBg:
          'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
        description: `Refunded ${amount}`,
        detail: amount,
        href: entry.order_id
          ? `/dashboard/${organizationSlug}/sales/${entry.order_id}`
          : undefined,
      }
    }
    case 'subscription_started': {
      return {
        icon: <ShoppingCart className="h-4 w-4" />,
        iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        description: 'Subscription started',
        detail: entry.product_name,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.subscription_id}`,
      }
    }
    case 'subscription_canceled': {
      return {
        icon: <XCircle className="h-4 w-4" />,
        iconBg: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
        description: 'Subscription canceled',
        detail: entry.product_name,
        href: `/dashboard/${organizationSlug}/sales/subscriptions/${entry.subscription_id}`,
      }
    }
  }
}

interface TimelineEntryRowProps {
  entry: TimelineEntry
  organizationSlug: string
  isLast: boolean
  compact?: boolean
}

const TimelineEntryRow: React.FC<TimelineEntryRowProps> = ({
  entry,
  organizationSlug,
  isLast,
  compact,
}) => {
  const meta = getEntryMeta(entry, organizationSlug)

  return (
    <div
      className={twMerge(
        'flex flex-row gap-4',
        compact ? 'items-start' : 'items-center',
      )}
    >
      <div className="flex flex-col items-center">
        <div
          className={twMerge(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            meta.iconBg,
          )}
        >
          {meta.icon}
        </div>
        {!isLast && <div className="dark:bg-polar-700 w-px grow bg-gray-200" />}
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
            {meta.detail && (
              <span className="dark:text-polar-500 text-gray-500">
                {meta.detail}
              </span>
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
            <span className="dark:text-polar-500 text-gray-500">
              {meta.detail}
            </span>
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

interface TimelineViewProps {
  entries: TimelineEntry[]
  organizationSlug: string
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  compact?: boolean
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  entries,
  organizationSlug,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  compact,
}) => {
  if (entries.length === 0) {
    return (
      <p className="dark:text-polar-500 text-sm text-gray-500">
        No activity yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      {entries.map((entry, i) => (
        <TimelineEntryRow
          key={`${entry.type}-${entry.id}-${entry.timestamp}`}
          entry={entry}
          organizationSlug={organizationSlug}
          isLast={i === entries.length - 1 && !hasNextPage}
          compact={compact}
        />
      ))}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            loading={isFetchingNextPage}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
