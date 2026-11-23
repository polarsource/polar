'use client'

import { type TimelineRange } from '@/utils/subscriptionTimeline'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRef, useState, type ReactNode, type Ref } from 'react'
import { twMerge } from 'tailwind-merge'
import { GanttAxis } from './GanttAxis'
import { GanttCorner } from './GanttCorner'
import { GanttNavigator } from './GanttNavigator'
import {
  DATE_LABEL_HEIGHT,
  DATE_LABEL_TOP,
  FOOTER_HEIGHT,
  HEADER_HEIGHT,
  LABELS_WIDTH_VAR,
  SURFACE_CLASS,
  type GanttScale,
  type GanttZoomHandle,
} from './scale'
import { useGanttLabelsResize } from './useGanttLabelsResize'
import { useGanttPointer } from './useGanttPointer'
import { useGanttViewport } from './useGanttViewport'

// Straddles the label column's right border, and draws over it while pointed at.
const RESIZER_CLASS =
  'absolute inset-y-0 -right-1 z-30 w-[9px] cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1 after:w-px hover:after:bg-gray-300 focus-visible:after:bg-gray-400 active:after:bg-gray-300 dark:hover:after:bg-polar-600 dark:focus-visible:after:bg-polar-500 dark:active:after:bg-polar-600'

export interface GanttContext {
  scale: GanttScale
  rendered: TimelineRange
  now: number
  getVisibleRows: (
    rowHeight: number,
    count: number,
  ) => { first: number; last: number }
}

interface GanttFrameProps {
  start: number
  zoom: number
  focus?: number
  zoomRef?: Ref<GanttZoomHandle>
  onZoomChange?: (zoom: number) => void
  cornerLabel: string
  /** Shown under the label column, beside the navigator. */
  footerLabel?: string
  children: (context: GanttContext) => { labels: ReactNode; track: ReactNode }
}

export const GanttFrame = ({
  start,
  zoom,
  focus,
  zoomRef,
  onZoomChange,
  cornerLabel,
  footerLabel,
  children,
}: GanttFrameProps) => {
  const [now] = useState(() => Date.now())
  const hoveredRef = useRef<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const {
    scrollerRef,
    labelsRef,
    yearRef,
    todayRef,
    scale,
    rendered,
    getVisibleRows,
    toTime,
    onScroll,
    scrollToTime,
    getView,
    setView,
    panHandlers,
  } = useGanttViewport({
    start,
    now,
    pixelsPerDay: zoom,
    focus,
    zoomRef,
    onZoomChange,
  })
  const {
    trackRef,
    cursorRef,
    cursorLabelRef,
    onMouseMove,
    onMouseLeave,
    syncCursor,
  } = useGanttPointer(toTime, now)

  const labelsResize = useGanttLabelsResize(frameRef, labelsRef)

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

  const { labels, track } = children({
    scale,
    rendered,
    now,
    getVisibleRows,
  })

  return (
    <div
      ref={frameRef}
      className="@container flex min-h-0 grow flex-col [--gantt-labels-width:160px] md:[--gantt-labels-width:272px]"
      style={labelsResize.style}
    >
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
        onClickCapture={(event) => {
          const jump = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-jump]',
          )
          if (jump) {
            event.stopPropagation()
            scrollToTime(Number(jump.dataset.jump))
          }
        }}
      >
        <Box flexShrink={0} minHeight="100%">
          <div
            ref={labelsRef}
            className={twMerge('sticky left-0 z-30 shrink-0', SURFACE_CLASS)}
          >
            <Box
              flexDirection="column"
              height="100%"
              width={`var(${LABELS_WIDTH_VAR})`}
              borderRightWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <GanttCorner label={cornerLabel} />
              {labels}
            </Box>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize column. Arrow keys resize, Enter resets."
              className={RESIZER_CLASS}
              {...labelsResize.handleProps}
            />
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
              onToday={() => scrollToTime(now)}
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
              left={scale.x(now)}
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
                top={DATE_LABEL_TOP}
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
      <Box
        flexShrink={0}
        height={FOOTER_HEIGHT}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box
          flexShrink={0}
          width={`var(${LABELS_WIDTH_VAR})`}
          alignItems="center"
          px="l"
          borderRightWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {footerLabel && (
            <Text color="muted" truncate tabularNums>
              {footerLabel}
            </Text>
          )}
        </Box>
        <Box flexGrow={1} minWidth={0} alignItems="center" px="m">
          <GanttNavigator
            start={start}
            now={now}
            scrollerRef={scrollerRef}
            getView={getView}
            setView={setView}
          />
        </Box>
      </Box>
    </div>
  )
}
