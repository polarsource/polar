'use client'

import { useInViewport } from '@/hooks/utils'
import {
  DAY_MS,
  getSubscriptionTimeline,
  getTimelineStart,
} from '@/utils/subscriptionTimeline'
import { schemas } from '@polar-sh/client'
import { Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { GanttBar } from './GanttBar'
import { GanttFrame } from './GanttFrame'
import { GanttRowLabel } from './GanttRowLabel'
import {
  MIN_CYCLE_WIDTH,
  ROW_HEIGHT,
  ROW_HOVERABLE_CLASS,
  ROW_SELECTED_CLASS,
  type GanttZoom,
} from './scale'
import { getGanttTone } from './tone'

interface SubscriptionsGanttProps {
  subscriptions: schemas['Subscription'][]
  earliest: number
  zoom: GanttZoom
  focus?: number
  selectedId: string | null
  onSelect: (id: string) => void
  isLoadingMore: boolean
  onEndReached: () => void
}

export const SubscriptionsGantt = ({
  subscriptions,
  earliest,
  zoom,
  focus,
  selectedId,
  onSelect,
  isLoadingMore,
  onEndReached,
}: SubscriptionsGanttProps) => {
  const { ref: endRef, inViewport: isEndVisible } =
    useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (isEndVisible && !isLoadingMore) {
      onEndReached()
    }
  }, [isEndVisible, isLoadingMore, onEndReached])

  const rowClassName = (id: string) =>
    id === selectedId ? ROW_SELECTED_CLASS : ROW_HOVERABLE_CLASS

  return (
    <GanttFrame
      start={getTimelineStart(subscriptions, earliest)}
      zoom={zoom}
      focus={focus}
      cornerLabel="Customer"
    >
      {({ scale, rendered, now }) => ({
        labels: (
          <>
            {subscriptions.map((subscription) => (
              <GanttRowLabel
                key={subscription.id}
                subscription={subscription}
                className={rowClassName(subscription.id)}
                onSelect={onSelect}
              />
            ))}
            <div ref={endRef} />
            {isLoadingMore && (
              <Box justifyContent="center" py="l">
                <Spinner />
              </Box>
            )}
          </>
        ),
        track: subscriptions.map((subscription) => (
          <div
            key={subscription.id}
            className={twMerge(
              'shrink-0 cursor-pointer',
              rowClassName(subscription.id),
            )}
            data-row={subscription.id}
            onClick={() => onSelect(subscription.id)}
          >
            <Box position="relative" height={ROW_HEIGHT}>
              <GanttBar
                timeline={getSubscriptionTimeline(subscription, {
                  now,
                  horizon: rendered.end,
                  minCycleDuration:
                    (MIN_CYCLE_WIDTH / scale.pixelsPerDay) * DAY_MS,
                })}
                scale={scale}
                rendered={rendered}
                tone={getGanttTone(subscription)}
                now={now}
              />
            </Box>
          </div>
        )),
      })}
    </GanttFrame>
  )
}
