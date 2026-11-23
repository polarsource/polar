'use client'

import { useInViewport } from '@/hooks/utils'
import {
  DAY_MS,
  getSubscriptionTimeline,
  getTimelineStart,
} from '@/utils/subscriptionTimeline'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { isKeyHandledElsewhere } from '@/components/Shared/CondensedTable/CondensedTable'
import { useEffect, type Ref } from 'react'
import { twMerge } from 'tailwind-merge'
import { GanttBar } from './GanttBar'
import { GanttFrame } from './GanttFrame'
import { GanttRowEdges } from './GanttRowEdges'
import { GanttRowLabel } from './GanttRowLabel'
import { GanttSkeletonLabels, GanttSkeletonTrack } from './GanttSkeleton'
import {
  MIN_CYCLE_WIDTH,
  ROW_HEIGHT,
  ROW_HOVERABLE_CLASS,
  ROW_SELECTED_CLASS,
  type GanttZoomHandle,
} from './scale'
import { getGanttTone } from './tone'

// Reaches up from the end of the list, so the next page is requested before the
// last row is on screen.
const LOAD_MORE_SENTINEL_CLASS =
  'pointer-events-none absolute bottom-0 left-0 h-[600px] w-px'

interface SubscriptionsGanttProps {
  /** Undefined while the first page loads. */
  subscriptions: schemas['Subscription'][] | undefined
  earliest: number
  zoom: number
  zoomRef?: Ref<GanttZoomHandle>
  onZoomChange?: (zoom: number) => void
  focus?: number
  footerLabel?: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  isLoadingMore: boolean
  onEndReached: () => void
}

export const SubscriptionsGantt = ({
  subscriptions: loaded,
  earliest,
  zoom,
  zoomRef,
  onZoomChange,
  focus,
  footerLabel,
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

  const subscriptions = loaded ?? []
  const rowClassName = (id: string) =>
    id === selectedId ? ROW_SELECTED_CLASS : ROW_HOVERABLE_CLASS

  useEffect(() => {
    // The selected one can be a linked subscription that is not loaded here.
    if (selectedId === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isKeyHandledElsewhere(event)) {
        onSelect(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, onSelect])

  return (
    <GanttFrame
      start={getTimelineStart(subscriptions, earliest)}
      zoom={zoom}
      zoomRef={zoomRef}
      onZoomChange={onZoomChange}
      focus={focus}
      cornerLabel="Customer"
      footerLabel={footerLabel}
    >
      {({ scale, rendered, now, getVisibleRows }) => {
        if (!loaded) {
          const { last: count } = getVisibleRows(ROW_HEIGHT, Infinity)
          return {
            labels: <GanttSkeletonLabels count={count} />,
            track: (
              <GanttSkeletonTrack
                count={count}
                scale={scale}
                rendered={rendered}
                now={now}
              />
            ),
          }
        }
        const { first, last } = getVisibleRows(ROW_HEIGHT, subscriptions.length)
        const visible = subscriptions.slice(first, last)
        const before = <Box flexShrink={0} height={first * ROW_HEIGHT} />
        const after = (
          <Box
            flexShrink={0}
            height={(subscriptions.length - last) * ROW_HEIGHT}
          />
        )
        return {
          labels: (
            <>
              {loaded.length === 0 && (
                <Box height={ROW_HEIGHT} alignItems="center" px="l">
                  <Text color="muted" wrap="nowrap">
                    No subscriptions found
                  </Text>
                </Box>
              )}
              {before}
              {visible.map((subscription) => (
                <GanttRowLabel
                  key={subscription.id}
                  subscription={subscription}
                  className={rowClassName(subscription.id)}
                  onSelect={onSelect}
                />
              ))}
              {after}
              <div className="relative">
                <div ref={endRef} className={LOAD_MORE_SENTINEL_CLASS} />
              </div>
              {isLoadingMore && (
                <Box justifyContent="center" py="l">
                  <Spinner />
                </Box>
              )}
            </>
          ),
          track: (
            <>
              {before}
              {visible.map((subscription) => {
                const timeline = getSubscriptionTimeline(subscription, {
                  now,
                  horizon: rendered.end,
                  minCycleDuration:
                    (MIN_CYCLE_WIDTH / scale.pixelsPerDay) * DAY_MS,
                })
                const lastEnd = timeline.segments.at(-1)?.end ?? timeline.start
                // A bar that reaches the rendered horizon keeps going.
                const end = lastEnd >= rendered.end ? Infinity : lastEnd
                return (
                  <div
                    key={subscription.id}
                    className={twMerge(
                      'group shrink-0 cursor-pointer',
                      rowClassName(subscription.id),
                    )}
                    data-row={subscription.id}
                    data-bar-start={timeline.start}
                    data-bar-end={end}
                    onClick={() => onSelect(subscription.id)}
                  >
                    <Box position="relative" height={ROW_HEIGHT}>
                      <GanttRowEdges
                        start={timeline.start}
                        end={end}
                        now={now}
                      />
                      <GanttBar
                        timeline={timeline}
                        scale={scale}
                        rendered={rendered}
                        tone={getGanttTone(subscription)}
                        now={now}
                        isSelected={subscription.id === selectedId}
                      />
                    </Box>
                  </div>
                )
              })}
              {after}
            </>
          ),
        }
      }}
    </GanttFrame>
  )
}
