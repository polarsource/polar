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
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { GanttAxis } from './GanttAxis'
import { GanttBar } from './GanttBar'
import { GanttCorner } from './GanttCorner'
import { GanttRowLabel } from './GanttRowLabel'
import {
  DATE_LABEL_HEIGHT,
  HEADER_HEIGHT,
  MIN_CYCLE_WIDTH,
  ROW_HEIGHT,
  ROW_HOVERABLE_CLASS,
  ROW_SELECTED_CLASS,
  SURFACE_CLASS,
  type GanttZoom,
} from './scale'
import { getGanttTone } from './tone'
import { useGanttPointer } from './useGanttPointer'
import { useGanttViewport } from './useGanttViewport'

interface SubscriptionsGanttProps {
  subscriptions: schemas['Subscription'][]
  earliest: number
  zoom: GanttZoom
  selectedId: string | null
  onSelect: (id: string) => void
  isLoadingMore: boolean
  onEndReached: () => void
}

export const SubscriptionsGantt = ({
  subscriptions,
  earliest,
  zoom,
  selectedId,
  onSelect,
  isLoadingMore,
  onEndReached,
}: SubscriptionsGanttProps) => {
  const [now] = useState(() => Date.now())
  const hoveredRef = useRef<string | null>(null)
  const { ref: endRef, inViewport: isEndVisible } =
    useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (isEndVisible && !isLoadingMore) {
      onEndReached()
    }
  }, [isEndVisible, isLoadingMore, onEndReached])

  const {
    scrollerRef,
    labelsRef,
    yearRef,
    scale,
    rendered,
    onScroll,
    scrollToToday,
    panHandlers,
  } = useGanttViewport({
    start: getTimelineStart(subscriptions, earliest),
    now,
    zoom,
  })
  const { trackRef, cursorRef, cursorLabelRef, onMouseMove, onMouseLeave } =
    useGanttPointer(scale, now)
  // Toggled on the DOM so hovering never waits for a render of every row.
  const setHoveredRow = (id: string | null) => {
    const scroller = scrollerRef.current
    if (!scroller || hoveredRef.current === id) return
    const rowsOf = (rowId: string) =>
      scroller.querySelectorAll<HTMLElement>(`[data-row="${rowId}"]`)
    if (hoveredRef.current) {
      rowsOf(hoveredRef.current).forEach((row) => delete row.dataset.hovered)
    }
    if (id) {
      rowsOf(id).forEach((row) => (row.dataset.hovered = 'true'))
    }
    hoveredRef.current = id
  }

  const rows = subscriptions.map((subscription) => ({
    subscription,
    className:
      subscription.id === selectedId ? ROW_SELECTED_CLASS : ROW_HOVERABLE_CLASS,
    timeline: getSubscriptionTimeline(subscription, {
      now,
      horizon: rendered.end,
      minCycleDuration: (MIN_CYCLE_WIDTH / scale.pixelsPerDay) * DAY_MS,
    }),
  }))

  return (
    <div
      ref={scrollerRef}
      className="flex min-h-80 grow [scrollbar-width:none] items-start overflow-auto [&::-webkit-scrollbar]:hidden"
      onScroll={onScroll}
      onMouseLeave={() => setHoveredRow(null)}
    >
      <Box flexShrink={0} minHeight="100%">
        <div
          ref={labelsRef}
          className={twMerge('sticky left-0 z-30 shrink-0', SURFACE_CLASS)}
        >
          <Box
            flexDirection="column"
            height="100%"
            width={{ base: 140, md: 300 }}
            borderRightWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <GanttCorner />
            {rows.map(({ subscription, className }) => (
              <GanttRowLabel
                key={subscription.id}
                subscription={subscription}
                className={className}
                onHover={setHoveredRow}
                onSelect={onSelect}
              />
            ))}
            <div ref={endRef} />
            {isLoadingMore && (
              <Box justifyContent="center" py="l">
                <Spinner />
              </Box>
            )}
          </Box>
        </div>
        <Box
          ref={trackRef}
          position="relative"
          flexDirection="column"
          flexShrink={0}
          width={scale.width}
          userSelect="none"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          {...panHandlers}
        >
          <GanttAxis
            scale={scale}
            rendered={rendered}
            now={now}
            onToday={scrollToToday}
            yearRef={yearRef}
          />
          {rows.map(({ subscription, className, timeline }) => (
            <div
              key={subscription.id}
              className={twMerge('shrink-0 cursor-pointer', className)}
              data-row={subscription.id}
              onMouseEnter={() => setHoveredRow(subscription.id)}
              onClick={() => onSelect(subscription.id)}
            >
              <Box position="relative" height={ROW_HEIGHT}>
                <GanttBar
                  timeline={timeline}
                  scale={scale}
                  rendered={rendered}
                  tone={getGanttTone(subscription)}
                  now={now}
                />
              </Box>
            </div>
          ))}
          <Box
            position="absolute"
            top={HEADER_HEIGHT}
            bottom={0}
            left={scale.toX(now)}
            width={1}
            backgroundColor="background-inverse"
            pointerEvents="none"
          />
          <Box
            ref={cursorRef}
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            zIndex={20}
            opacity={0}
            pointerEvents="none"
          >
            <Box
              position="absolute"
              top={HEADER_HEIGHT}
              bottom={0}
              borderLeftWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            />
            <Box
              position="sticky"
              top={(HEADER_HEIGHT - DATE_LABEL_HEIGHT) / 2}
              alignSelf="start"
              flexShrink={0}
              height={DATE_LABEL_HEIGHT}
              transform="translateX(-50%)"
              alignItems="center"
              px="s"
              borderRadius="s"
              backgroundColor="background-inverse"
            >
              <Text variant="caption" color="inverse" wrap="nowrap" tabularNums>
                <span ref={cursorLabelRef} />
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </div>
  )
}
