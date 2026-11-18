import { DAY_MS, type TimelineRange } from '@/utils/subscriptionTimeline'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  createGanttScale,
  FALLBACK_VIEWPORT_WIDTH,
  GANTT_ZOOM_DAYS,
  TODAY_VIEWPORT_RATIO,
  type GanttZoom,
} from './scale'

const WINDOW_SPANS = 2.5
const DRAG_THRESHOLD = 4

interface UseGanttViewportOptions {
  start: number
  now: number
  zoom: GanttZoom
  focus?: number
}

// The timeline has no fixed end. Only a window around the viewport is rendered,
// and it follows the scroll position, so the scrollable width keeps growing.
export const useGanttViewport = ({
  start,
  now,
  zoom,
  focus = now,
}: UseGanttViewportOptions) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef(focus)
  const yearRef = useRef<HTMLSpanElement>(null)
  const todayRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(
    null,
  )
  const suppressClickRef = useRef(false)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [center, setCenter] = useState(focus)

  const span = GANTT_ZOOM_DAYS[zoom] * DAY_MS
  const rendered: TimelineRange = {
    start: Math.max(start, center - WINDOW_SPANS * span),
    end: center + WINDOW_SPANS * span,
  }
  const scale = createGanttScale(
    { start, end: rendered.end },
    (viewportWidth || FALLBACK_VIEWPORT_WIDTH) / GANTT_ZOOM_DAYS[zoom],
  )

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(
        entry.contentRect.width - (labelsRef.current?.offsetWidth ?? 0),
      ),
    )
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // The pill follows a spacer that ends where today is, so any distance between
  // the two means the pill is stuck to an edge.
  const syncHeader = (time: number) => {
    if (yearRef.current) {
      yearRef.current.textContent = String(new Date(time).getFullYear())
    }
    const today = todayRef.current
    const spacer = today?.previousElementSibling
    if (today && spacer) {
      const offset =
        today.getBoundingClientRect().left -
        spacer.getBoundingClientRect().right
      today.dataset.stuck = String(Math.abs(offset) > 0.5)
    }
  }

  const anchorOffset = viewportWidth * TODAY_VIEWPORT_RATIO
  const { pixelsPerDay } = scale
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (viewportWidth === 0 || !scroller) return
    scroller.scrollLeft =
      ((anchorRef.current - start) / DAY_MS) * pixelsPerDay - anchorOffset
    syncHeader(
      start + ((scroller.scrollLeft + viewportWidth) / pixelsPerDay) * DAY_MS,
    )
  }, [start, pixelsPerDay, viewportWidth, anchorOffset])

  const onScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller || viewportWidth === 0) return
    anchorRef.current = scale.toTime(scroller.scrollLeft + anchorOffset)
    syncHeader(scale.toTime(scroller.scrollLeft + viewportWidth))
    const visibleCenter = scale.toTime(scroller.scrollLeft + viewportWidth / 2)
    if (Math.abs(visibleCenter - center) > span) {
      setCenter(visibleCenter)
    }
  }

  const scrollToToday = () =>
    scrollerRef.current?.scrollTo({
      left: scale.toX(now) - anchorOffset,
      behavior: 'smooth',
    })

  const panHandlers = {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      dragRef.current = {
        x: event.clientX,
        left: scrollerRef.current?.scrollLeft ?? 0,
        moved: false,
      }
    },
    onPointerMove: (event: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !scrollerRef.current) return
      const distance = event.clientX - drag.x
      if (!drag.moved && Math.abs(distance) < DRAG_THRESHOLD) return
      drag.moved = true
      scrollerRef.current.scrollLeft = drag.left - distance
    },
    onPointerUp: () => {
      suppressClickRef.current = dragRef.current?.moved ?? false
      dragRef.current = null
    },
    onPointerLeave: () => {
      dragRef.current = null
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        event.stopPropagation()
      }
    },
  }

  return {
    scrollerRef,
    labelsRef,
    yearRef,
    todayRef,
    scale,
    rendered,
    onScroll,
    scrollToToday,
    panHandlers,
  }
}
