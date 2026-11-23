'use client'

import {
  aggregateSubscriptions,
  type AggregateGroup,
  type AggregateRow,
  type AggregateUnit,
} from '@/utils/subscriptionAggregate'
import { getTimelineStart } from '@/utils/subscriptionTimeline'
import { schemas } from '@polar-sh/client'
import { format } from 'date-fns'
import { useState, type Ref } from 'react'
import { formatRecurringSchedule } from '../SubscriptionDetailsGrid'
import { AggregateCells } from './AggregateCells'
import { AggregateRowLabel } from './AggregateRowLabel'
import { GanttFrame } from './GanttFrame'
import { type GanttGroup, type GanttZoomHandle } from './scale'

export type AggregateGrouping = Exclude<GanttGroup, 'customer'>

const TOTAL_ROW_HEIGHT = 280
const GROUP_ROW_HEIGHT = 128

const WEEKLY_MIN_PIXELS_PER_DAY = 5

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

// Hovering a period renders the frame again. The sums only change with what
// they are computed from, so the last result is kept.
let lastAggregate: { inputs: unknown[]; rows: AggregateRow[] } | null = null
const aggregate = (
  ...[subscriptions, options]: Parameters<typeof aggregateSubscriptions>
): AggregateRow[] => {
  const inputs = [
    subscriptions,
    options.unit,
    options.range.start,
    options.range.end,
    options.now,
    options.groupOf,
  ]
  if (!lastAggregate?.inputs.every((input, index) => input === inputs[index])) {
    lastAggregate = {
      inputs,
      rows: aggregateSubscriptions(subscriptions, options),
    }
  }
  return lastAggregate.rows
}

const formatPeriod = (start: number, unit: AggregateUnit) =>
  unit === 'week'
    ? `Week of ${format(start, 'MMM d')}`
    : format(start, 'MMMM yyyy')

interface AggregateTimelineProps {
  subscriptions: schemas['Subscription'][]
  earliest: number
  zoom: number
  zoomRef?: Ref<GanttZoomHandle>
  onZoomChange?: (zoom: number) => void
  group: AggregateGrouping
  footerLabel?: string
  onSelect: (selection: { groupKey: string; start?: number }) => void
}

export const AggregateTimeline = ({
  subscriptions,
  earliest,
  zoom,
  zoomRef,
  onZoomChange,
  group,
  footerLabel,
  onSelect,
}: AggregateTimelineProps) => {
  const [hoveredStart, setHoveredStart] = useState<number | null>(null)
  const unit: AggregateUnit =
    zoom >= WEEKLY_MIN_PIXELS_PER_DAY ? 'week' : 'month'
  const { cornerLabel, groupOf } = GROUPINGS[group]
  const height = group === 'total' ? TOTAL_ROW_HEIGHT : GROUP_ROW_HEIGHT

  return (
    <GanttFrame
      start={getTimelineStart(subscriptions, earliest)}
      zoom={zoom}
      zoomRef={zoomRef}
      onZoomChange={onZoomChange}
      cornerLabel={cornerLabel}
      footerLabel={footerLabel}
    >
      {({ scale, rendered, now }) => {
        const rows = aggregate(subscriptions, {
          unit,
          range: rendered,
          now,
          groupOf,
        })
        // The periods change with the zoom and the range, which can leave the
        // hovered one behind.
        const hovered = rows[0]?.buckets.some(
          ({ start }) => start === hoveredStart,
        )
          ? hoveredStart
          : null
        return {
          labels: rows.map((row) => (
            <AggregateRowLabel
              key={row.id}
              row={row}
              height={height}
              bucket={row.buckets.find(({ start }) => start === hovered)}
              periodLabel={
                hovered === null ? null : formatPeriod(hovered, unit)
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
                  key={row.id}
                  row={row}
                  height={height}
                  scale={scale}
                  hoveredStart={hovered}
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
