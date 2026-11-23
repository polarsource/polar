import { DAY_MS, type TimelineRange } from '@/utils/subscriptionTimeline'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react'
import {
  createGanttScale,
  FALLBACK_VIEWPORT_HEIGHT,
  FALLBACK_VIEWPORT_WIDTH,
  MAX_PIXELS_PER_DAY,
  NAVIGATOR_FUTURE_DAYS,
  PIXELS_PER_DAY_VAR,
  ROW_HEIGHT,
  TODAY_VIEWPORT_RATIO,
  type GanttView,
  type GanttZoomHandle,
} from './scale'
import { useGanttPan } from './useGanttPan'

const WINDOW_SPANS = 1.75
const ROW_OVERSCAN = 6
const PINCH_SPEED = 0.01

// The pill follows a spacer that ends where today is, so any distance between
// the two means the pill is stuck to an edge.
const updateHeader = (
  year: HTMLElement | null,
  today: HTMLElement | null,
  time: number,
) => {
  if (year) {
    year.textContent = String(new Date(time).getFullYear())
  }
  const spacer = today?.previousElementSibling
  if (today && spacer) {
    const offset =
      today.getBoundingClientRect().left - spacer.getBoundingClientRect().right
    // Held right of its place means today lies to the left, and vice versa.
    today.dataset.stuck =
      Math.abs(offset) <= 0.5 ? 'none' : offset > 0 ? 'left' : 'right'
  }
}

// Marks each row whose bar lies wholly outside the visible time range, so the
// row can show which way it is. Done on the DOM because it changes on scroll.
const updateRowEdges = (
  scroller: HTMLElement,
  visibleStart: number,
  visibleEnd: number,
) => {
  for (const row of scroller.querySelectorAll<HTMLElement>(
    '[data-bar-start]',
  )) {
    const out =
      Number(row.dataset.barStart) > visibleEnd
        ? 'right'
        : Number(row.dataset.barEnd) < visibleStart
          ? 'left'
          : 'none'
    if (row.dataset.out !== out) {
      row.dataset.out = out
    }
  }
}

interface UseGanttViewportOptions {
  start: number
  now: number
  pixelsPerDay: number
  focus?: number
  zoomRef?: Ref<GanttZoomHandle>
  onZoomChange?: (pixelsPerDay: number) => void
}

// The timeline has no fixed end. Only a window around the viewport is rendered,
// and it follows the scroll position, so the scrollable width keeps growing.
export const useGanttViewport = ({
  start,
  now,
  pixelsPerDay,
  focus = now,
  zoomRef,
  onZoomChange,
}: UseGanttViewportOptions) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef(focus)
  const yearRef = useRef<HTMLSpanElement>(null)
  const todayRef = useRef<HTMLButtonElement>(null)
  const pixelsPerDayRef = useRef(pixelsPerDay)
  const viewportWidthRef = useRef(0)
  const isZoomingRef = useRef(false)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [center, setCenter] = useState(focus)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  const span =
    ((viewportWidth || FALLBACK_VIEWPORT_WIDTH) / pixelsPerDay) * DAY_MS
  const rendered: TimelineRange = {
    start: Math.max(start, center - WINDOW_SPANS * span),
    end: center + WINDOW_SPANS * span,
  }
  // The track is wider than what is rendered, so the navigator can move the
  // view anywhere on its strip without waiting for a render.
  const scale = createGanttScale(
    {
      start,
      end: Math.max(rendered.end, now + NAVIGATOR_FUTURE_DAYS * DAY_MS),
    },
    pixelsPerDay,
  )

  // Layout effect: the first measurement has to land before the first paint,
  // or the chart is drawn once at a fallback width and then jumps.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const measure = () => {
      setViewportWidth(
        scroller.clientWidth - (labelsRef.current?.offsetWidth ?? 0),
      )
      setViewportHeight(scroller.clientHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    // The label column can be resized, which changes how much track is in view.
    if (labelsRef.current) observer.observe(labelsRef.current)
    return () => observer.disconnect()
  }, [])

  const anchorOffset = viewportWidth * TODAY_VIEWPORT_RATIO
  const toTime = (x: number) => start + (x / pixelsPerDayRef.current) * DAY_MS
  const toX = (time: number) =>
    ((time - start) / DAY_MS) * pixelsPerDayRef.current
  const syncHeader = (time: number) =>
    updateHeader(yearRef.current, todayRef.current, time)
  const syncRowEdges = () => {
    const scroller = scrollerRef.current
    if (scroller && viewportWidth > 0) {
      updateRowEdges(
        scroller,
        toTime(scroller.scrollLeft),
        toTime(scroller.scrollLeft + viewportWidth),
      )
    }
  }

  // Rows mount and unmount as the list scrolls, so new ones need marking too.
  useLayoutEffect(syncRowEdges)

  // Memoized by hand: it is an effect dependency, and the effect must not run
  // again mid-drag and reset the zoom to the last rendered value.
  const applyZoom = useCallback(
    (next: number) => {
      const scroller = scrollerRef.current
      if (!scroller) return
      scroller.style.setProperty(PIXELS_PER_DAY_VAR, String(next))
      pixelsPerDayRef.current = next
      const width = viewportWidthRef.current
      if (width === 0) return
      isZoomingRef.current = true
      scroller.scrollLeft =
        ((anchorRef.current - start) / DAY_MS) * next -
        width * TODAY_VIEWPORT_RATIO
      const visibleStart = start + (scroller.scrollLeft / next) * DAY_MS
      const visibleEnd = visibleStart + (width / next) * DAY_MS
      updateHeader(yearRef.current, todayRef.current, visibleEnd)
      updateRowEdges(scroller, visibleStart, visibleEnd)
    },
    [start],
  )

  // A change in width never moves the content: the scale and the scroll offset
  // stay, and only the anchor is read again for the new width. The exception is
  // the first measurement, which is when the chart is positioned.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const previous = viewportWidthRef.current
    viewportWidthRef.current = viewportWidth
    if (!scroller || viewportWidth === 0 || previous === viewportWidth) return
    if (previous === 0) {
      applyZoom(pixelsPerDayRef.current)
      return
    }
    const visibleStart =
      start + (scroller.scrollLeft / pixelsPerDayRef.current) * DAY_MS
    anchorRef.current =
      visibleStart +
      ((viewportWidth * TODAY_VIEWPORT_RATIO) / pixelsPerDayRef.current) *
        DAY_MS
    const visibleEnd =
      visibleStart + (viewportWidth / pixelsPerDayRef.current) * DAY_MS
    updateHeader(yearRef.current, todayRef.current, visibleEnd)
    updateRowEdges(scroller, visibleStart, visibleEnd)
  }, [applyZoom, start, viewportWidth])

  useLayoutEffect(() => {
    applyZoom(pixelsPerDay)
  }, [applyZoom, pixelsPerDay])

  // A trackpad pinch arrives as a wheel event with ctrlKey set. It zooms around
  // the pointer, and reports the new scale so the caller can keep it.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const current = pixelsPerDayRef.current
      // Zoomed all the way out, the view holds the navigator's whole strip.
      const fit =
        viewportWidthRef.current /
        ((now - start) / DAY_MS + NAVIGATOR_FUTURE_DAYS)
      const next = Math.min(
        MAX_PIXELS_PER_DAY,
        Math.max(fit, current * Math.exp(-event.deltaY * PINCH_SPEED)),
      )
      const pointerX =
        event.clientX -
        scroller.getBoundingClientRect().left -
        (labelsRef.current?.offsetWidth ?? 0)
      const days = (scroller.scrollLeft + pointerX) / current
      scroller.style.setProperty(PIXELS_PER_DAY_VAR, String(next))
      pixelsPerDayRef.current = next
      isZoomingRef.current = true
      scroller.scrollLeft = days * next - pointerX
      anchorRef.current =
        start +
        ((scroller.scrollLeft +
          viewportWidthRef.current * TODAY_VIEWPORT_RATIO) /
          next) *
          DAY_MS
      onZoomChange?.(next)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [start, now, onZoomChange])

  const onScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller || viewportWidth === 0) return
    // A scroll caused by zooming keeps the anchor, so rounding cannot move it.
    if (isZoomingRef.current) {
      isZoomingRef.current = false
    } else {
      anchorRef.current = toTime(scroller.scrollLeft + anchorOffset)
    }
    syncHeader(toTime(scroller.scrollLeft + viewportWidth))
    syncRowEdges()
    // Measured at the live zoom, not the rendered one: mid-zoom the two differ,
    // and a threshold from a wider zoom would leave the window far behind.
    const visibleCenter = toTime(scroller.scrollLeft + viewportWidth / 2)
    const liveSpan = (viewportWidth / pixelsPerDayRef.current) * DAY_MS
    if (Math.abs(visibleCenter - center) > Math.min(span, liveSpan)) {
      setCenter(visibleCenter)
    }
    setScrollTop(Math.floor(scroller.scrollTop / ROW_HEIGHT) * ROW_HEIGHT)
  }

  // Rows outside the viewport are not rendered. The caller pads for them.
  const getVisibleRows = (rowHeight: number, count: number) => {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - ROW_OVERSCAN)
    const visible =
      Math.ceil((viewportHeight || FALLBACK_VIEWPORT_HEIGHT) / rowHeight) +
      ROW_OVERSCAN * 2
    return { first, last: Math.min(count, first + visible) }
  }

  const scrollToTime = (time: number) =>
    scrollerRef.current?.scrollTo({
      left: toX(time) - anchorOffset,
      behavior: 'smooth',
    })

  const getView = (): GanttView | null => {
    const scroller = scrollerRef.current
    const width = viewportWidthRef.current
    if (!scroller || width === 0) return null
    return {
      start: toTime(scroller.scrollLeft),
      end: toTime(scroller.scrollLeft + width),
      width,
      pixelsPerDay: pixelsPerDayRef.current,
    }
  }

  // Puts a given time at the left edge, at a given zoom.
  const setView = (visibleStart: number, next: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (next !== pixelsPerDayRef.current) {
      scroller.style.setProperty(PIXELS_PER_DAY_VAR, String(next))
      pixelsPerDayRef.current = next
      onZoomChange?.(next)
    }
    scroller.scrollLeft = toX(visibleStart)
    // No scroll event follows when only the zoom changed.
    onScroll()
  }

  useImperativeHandle(zoomRef, () => ({
    zoomTo: applyZoom,
    scrollToToday: () => scrollToTime(now),
  }))

  const panHandlers = useGanttPan(scrollerRef)

  return {
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
  }
}
