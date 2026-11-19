'use client'

import {
  AggregateTimeline,
  type AggregateGrouping,
} from '@/components/Subscriptions/Gantt/AggregateTimeline'
import { useAllSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { type Ref } from 'react'
import { type GanttZoomHandle } from '@/components/Subscriptions/Gantt/scale'

interface SubscriptionsAggregateViewProps {
  organization: schemas['Organization']
  filters: Parameters<typeof useAllSubscriptions>[1]
  zoom: number
  zoomRef: Ref<GanttZoomHandle>
  onZoomChange: (zoom: number) => void
  group: AggregateGrouping
  onSelect: (selection: { groupKey: string; start?: number }) => void
}

export const SubscriptionsAggregateView = ({
  organization,
  filters,
  zoom,
  zoomRef,
  onZoomChange,
  group,
  onSelect,
}: SubscriptionsAggregateViewProps) => {
  const timeline = {
    earliest: new Date(organization.created_at).getTime(),
    zoom,
    zoomRef,
    onZoomChange,
    group,
    onSelect,
  }
  const { subscriptions, isLoading } = useAllSubscriptions(
    organization.id,
    filters,
  )

  // The frame stays up while pages load, so the layout does not jump.
  if (!subscriptions || (isLoading && subscriptions.length === 0)) {
    return <AggregateTimeline {...timeline} subscriptions={[]} />
  }
  return <AggregateTimeline {...timeline} subscriptions={subscriptions} />
}
