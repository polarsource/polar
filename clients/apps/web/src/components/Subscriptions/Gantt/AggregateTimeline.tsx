'use client'

import {
  aggregateSubscriptions,
  type AggregateGroup,
  type AggregateUnit,
} from '@/utils/subscriptionAggregate'
import { getTimelineStart } from '@/utils/subscriptionTimeline'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useState } from 'react'
import { formatRecurringSchedule } from '../SubscriptionDetailsGrid'
import { AggregateCells } from './AggregateCells'
import { AggregateRowLabel } from './AggregateRowLabel'
import { GanttFrame } from './GanttFrame'
import { type GanttGroup, type GanttZoom } from './scale'

export type AggregateGrouping = Exclude<GanttGroup, 'customer'>

const TOTAL_ROW_HEIGHT = 280
const GROUP_ROW_HEIGHT = 128

const UNITS: Record<GanttZoom, AggregateUnit> = {
  '3M': 'week',
  '6M': 'week',
  '1Y': 'month',
  '3Y': 'month',
}

const GROUPINGS: Record<
  AggregateGrouping,
  {
    cornerLabel: string
    groupOf: (subscription: schemas['Subscription']) => AggregateGroup
  }
> = {
  total: {
    cornerLabel: 'Total',
    groupOf: () => ({ key: 'all', label: 'All subscriptions' }),
  },
  product: {
    cornerLabel: 'Product',
    groupOf: ({ product }) => ({ key: product.id, label: product.name }),
  },
  interval: {
    cornerLabel: 'Billing interval',
    groupOf: ({ recurring_interval, recurring_interval_count }) => ({
      key: `${recurring_interval_count}-${recurring_interval}`,
      label: formatRecurringSchedule(
        recurring_interval,
        recurring_interval_count,
      ),
    }),
  },
}

const formatPeriod = (start: number, unit: AggregateUnit) =>
  unit === 'week'
    ? `Week of ${format(start, 'MMM d')}`
    : format(start, 'MMMM yyyy')

interface AggregateTimelineProps {
  subscriptions: schemas['Subscription'][]
  earliest: number
  zoom: GanttZoom
  group: AggregateGrouping
  onSelect: (selection: { groupKey: string; start?: number }) => void
}

export const AggregateTimeline = ({
  subscriptions,
  earliest,
  zoom,
  group,
  onSelect,
}: AggregateTimelineProps) => {
  const [hoveredStart, setHoveredStart] = useState<number | null>(null)
  const unit = UNITS[zoom]
  const { cornerLabel, groupOf } = GROUPINGS[group]
  const height = group === 'total' ? TOTAL_ROW_HEIGHT : GROUP_ROW_HEIGHT

  return (
    <GanttFrame
      start={getTimelineStart(subscriptions, earliest)}
      zoom={zoom}
      cornerLabel={cornerLabel}
    >
      {({ scale, rendered, now }) => {
        const rows = aggregateSubscriptions(subscriptions, {
          unit,
          range: rendered,
          now,
          groupOf,
        })
        return {
          labels: rows.map((row) => (
            <AggregateRowLabel
              key={row.key}
              row={row}
              height={height}
              bucket={row.buckets.find(({ start }) => start === hoveredStart)}
              periodLabel={
                hoveredStart === null ? null : formatPeriod(hoveredStart, unit)
              }
              onSelect={
                group === 'product'
                  ? () => onSelect({ groupKey: row.key })
                  : undefined
              }
            />
          )),
          track: (
            <div onMouseLeave={() => setHoveredStart(null)}>
              {rows.map((row) => (
                <AggregateCells
                  key={row.key}
                  row={row}
                  height={height}
                  scale={scale}
                  hoveredStart={hoveredStart}
                  onHover={setHoveredStart}
                  onSelect={(start) => onSelect({ groupKey: row.key, start })}
                />
              ))}
            </div>
          ),
        }
      }}
    </GanttFrame>
  )
}
