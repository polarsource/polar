'use client'

import {
  AggregateTimeline,
  type AggregateGrouping,
} from '@/components/Subscriptions/Gantt/AggregateTimeline'
import { useAllSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type Ref } from 'react'
import { type GanttZoomHandle } from '@/components/Subscriptions/Gantt/scale'

interface SubscriptionsAggregateViewProps {
  organization: schemas['Organization']
  filters: Parameters<typeof useAllSubscriptions>[1]
  zoom: number
  zoomRef: Ref<GanttZoomHandle>
  onZoomChange: (zoom: number) => void
  group: AggregateGrouping
  footerLabel?: string
  onSelect: (selection: { groupKey: string; start?: number }) => void
}

export const SubscriptionsAggregateView = ({
  organization,
  filters,
  zoom,
  zoomRef,
  onZoomChange,
  group,
  footerLabel,
  onSelect,
}: SubscriptionsAggregateViewProps) => {
  const timeline = {
    earliest: new Date(organization.created_at).getTime(),
    zoom,
    zoomRef,
    onZoomChange,
    group,
    footerLabel,
    onSelect,
  }
  const { subscriptions, isLoading, isError, retry } = useAllSubscriptions(
    organization.id,
    filters,
  )

  // Sums over part of the subscriptions would read as the whole.
  if (isError) {
    return (
      <Box
        flexGrow={1}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="m"
      >
        <Text color="muted">Could not load all subscriptions</Text>
        <Button size="sm" variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
      </Box>
    )
  }

  // The frame stays up while pages load, so the layout does not jump.
  if (!subscriptions || (isLoading && subscriptions.length === 0)) {
    return <AggregateTimeline {...timeline} subscriptions={[]} />
  }
  return <AggregateTimeline {...timeline} subscriptions={subscriptions} />
}
