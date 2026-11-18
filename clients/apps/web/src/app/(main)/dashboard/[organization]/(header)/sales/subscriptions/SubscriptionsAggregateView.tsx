'use client'

import {
  AggregateTimeline,
  type AggregateGrouping,
} from '@/components/Subscriptions/Gantt/AggregateTimeline'
import { type GanttZoom } from '@/components/Subscriptions/Gantt/scale'
import { useAllSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface SubscriptionsAggregateViewProps {
  organization: schemas['Organization']
  filters: Parameters<typeof useAllSubscriptions>[1]
  zoom: GanttZoom
  group: AggregateGrouping
  onSelect: (selection: { groupKey: string; start?: number }) => void
}

export const SubscriptionsAggregateView = ({
  organization,
  filters,
  zoom,
  group,
  onSelect,
}: SubscriptionsAggregateViewProps) => {
  const { subscriptions, isLoading } = useAllSubscriptions(
    organization.id,
    filters,
  )

  if (!subscriptions || isLoading) {
    return (
      <Box justifyContent="center" py="3xl" flexGrow={1}>
        <Spinner />
      </Box>
    )
  }
  if (subscriptions.length === 0) {
    return (
      <Box justifyContent="center" py="3xl" flexGrow={1}>
        <Text color="muted">No subscriptions found</Text>
      </Box>
    )
  }
  return (
    <AggregateTimeline
      subscriptions={subscriptions}
      earliest={new Date(organization.created_at).getTime()}
      zoom={zoom}
      group={group}
      onSelect={onSelect}
    />
  )
}
