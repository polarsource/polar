'use client'

import {
  type GanttGroup,
  type GanttZoomHandle,
} from '@/components/Subscriptions/Gantt/scale'
import { type useAllSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import dynamic from 'next/dynamic'
import { type Ref } from 'react'

// The timeline is laid out from the current time and the local timezone, so
// it cannot be rendered on the server without a hydration mismatch.
const ChartPlaceholder = () => <Box flexGrow={1} />

const SubscriptionsGantt = dynamic(
  () =>
    import('@/components/Subscriptions/Gantt/SubscriptionsGantt').then(
      (module) => module.SubscriptionsGantt,
    ),
  { ssr: false, loading: ChartPlaceholder },
)

const SubscriptionsAggregateView = dynamic(
  () =>
    import('./SubscriptionsAggregateView').then(
      (module) => module.SubscriptionsAggregateView,
    ),
  { ssr: false, loading: ChartPlaceholder },
)

interface SubscriptionsTimelineProps {
  organization: schemas['Organization']
  group: GanttGroup
  // The loaded pages, for the timeline with a row per subscription.
  subscriptions: schemas['Subscription'][] | undefined
  // The grouped timelines load every subscription that matches these.
  filters: Parameters<typeof useAllSubscriptions>[1]
  zoom: number
  zoomRef: Ref<GanttZoomHandle>
  onZoomChange: (zoom: number) => void
  focus?: number
  footerLabel?: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  isLoadingMore: boolean
  onEndReached: () => void
  onDrillDown: (selection: { groupKey: string; start?: number }) => void
}

export const SubscriptionsTimeline = ({
  organization,
  group,
  subscriptions,
  filters,
  zoom,
  zoomRef,
  onZoomChange,
  focus,
  footerLabel,
  selectedId,
  onSelect,
  isLoadingMore,
  onEndReached,
  onDrillDown,
}: SubscriptionsTimelineProps) => (
  <Box flexDirection="column" flexGrow={1} minHeight={0}>
    {group !== 'customer' ? (
      <SubscriptionsAggregateView
        organization={organization}
        filters={filters}
        zoom={zoom}
        zoomRef={zoomRef}
        onZoomChange={onZoomChange}
        group={group}
        footerLabel={footerLabel}
        onSelect={onDrillDown}
      />
    ) : (
      <SubscriptionsGantt
        subscriptions={subscriptions}
        earliest={new Date(organization.created_at).getTime()}
        zoom={zoom}
        zoomRef={zoomRef}
        onZoomChange={onZoomChange}
        focus={focus}
        footerLabel={footerLabel}
        selectedId={selectedId}
        onSelect={onSelect}
        isLoadingMore={isLoadingMore}
        onEndReached={onEndReached}
      />
    )}
  </Box>
)
