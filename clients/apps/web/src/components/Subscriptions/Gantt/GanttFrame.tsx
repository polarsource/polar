'use client'

import { type TimelineRange } from '@/utils/subscriptionTimeline'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRef, useState, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { GanttAxis } from './GanttAxis'
import { GanttCorner } from './GanttCorner'
import {
  DATE_LABEL_HEIGHT,
  HEADER_HEIGHT,
  SURFACE_CLASS,
  type GanttScale,
  type GanttZoom,
} from './scale'
import { useGanttPointer } from './useGanttPointer'
import { useGanttViewport } from './useGanttViewport'

export interface GanttContext {
  scale: GanttScale
  rendered: TimelineRange
  now: number
}

interface GanttFrameProps {
  start: number
  zoom: GanttZoom
  focus?: number
  cornerLabel: string
  children: (context: GanttContext) => { labels: ReactNode; track: ReactNode }
}

export const GanttFrame = ({
  start,
  zoom,
  focus,
  cornerLabel,
  children,
}: GanttFrameProps) => {
  const [now] = useState(() => Date.now())
  const hoveredRef = useRef<string | null>(null)
  const {
    scrollerRef,
    labelsRef,
    yearRef,
    todayRef,
    scale,
    rendered,
    onScroll,
    scrollToToday,
    panHandlers,
  } = useGanttViewport({ start, now, zoom, focus })
  const {
    trackRef,
    cursorRef,
    cursorLabelRef,
    onMouseMove,
    onMouseLeave,
    syncCursor,
  } = useGanttPointer(scale, now)

  // Toggled on the DOM so hovering never waits for a render of every row.
  const hoverRow = (id: string | null) => {
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

  const { labels, track } = children({ scale, rendered, now })

  return (
    <div
      ref={scrollerRef}
      className="flex min-h-80 grow [scrollbar-width:none] items-start overflow-auto [&::-webkit-scrollbar]:hidden"
      onScroll={() => {
        onScroll()
        syncCursor()
      }}
      onMouseOver={(event) =>
        hoverRow(
          (event.target as HTMLElement).closest<HTMLElement>('[data-row]')
            ?.dataset.row ?? null,
        )
      }
      onMouseLeave={() => hoverRow(null)}
    >
      <Box flexShrink={0} minHeight="100%">
        <div
          ref={labelsRef}
          className={twMerge('sticky left-0 z-30 shrink-0', SURFACE_CLASS)}
        >
          <Box
            flexDirection="column"
            height="100%"
            width={{ base: 140, md: 256 }}
            borderRightWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <GanttCorner label={cornerLabel} />
            {labels}
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
            todayRef={todayRef}
          />
          <div className="flex flex-col" data-gantt-rows>
            {track}
          </div>
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
              backgroundColor="background-card"
            >
              <Text variant="caption" wrap="nowrap" tabularNums>
                <span ref={cursorLabelRef} />
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </div>
  )
}
