import { DAY_MS } from '@/utils/subscriptionTimeline'
import {
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type RefObject,
} from 'react'
import {
  MAX_PIXELS_PER_DAY,
  NAVIGATOR_FUTURE_DAYS,
  type GanttView,
} from './scale'

// The strip holds the pointer during a drag, so it carries the drag's cursor.
const TRACK_CLASS =
  'dark:bg-polar-800 relative h-3 grow cursor-pointer touch-none rounded-full bg-gray-100 data-[drag=end]:cursor-ew-resize data-[drag=pan]:cursor-grabbing data-[drag=start]:cursor-ew-resize'
const THUMB_CLASS =
  'dark:bg-polar-600 dark:hover:bg-polar-500/30 absolute inset-y-0 min-w-6 cursor-grab rounded-full transition-colors duration-[120ms] bg-gray-300 hover:bg-gray-400/60 active:cursor-grabbing'
// Each end of the thumb is a grip, marked by a dot.
const GRIP_CLASS =
  'absolute inset-y-0 w-3 cursor-ew-resize after:absolute after:top-1/2 after:left-1/2 after:size-1 after:-translate-1/2 after:rounded-full after:bg-gray-600 dark:after:bg-polar-200'
const TODAY_CLASS =
  'dark:bg-polar-400 pointer-events-none absolute inset-y-[3px] w-0.5 -translate-x-1/2 rounded-full bg-gray-500'

type DragMode = 'pan' | 'start' | 'end'

interface Drag {
  mode: DragMode
  pointerX: number
  view: GanttView
  extentEnd: number
  msPerPixel: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

interface GanttNavigatorProps {
  start: number
  now: number
  scrollerRef: RefObject<HTMLElement | null>
  getView: () => GanttView | null
  setView: (visibleStart: number, pixelsPerDay: number) => void
}

// The whole timeline as a strip, with the part in view as a thumb on it. The
// thumb slides to pan, and either end drags to zoom while the other end stays.
// The timeline has no end, so the strip reaches a few years ahead and grows
// when the view goes past that.
export const GanttNavigator = ({
  start,
  now,
  scrollerRef,
  getView,
  setView,
}: GanttNavigatorProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const extentEndOf = (view: GanttView) =>
    Math.max(now + NAVIGATOR_FUTURE_DAYS * DAY_MS, view.end)

  // Placed on the DOM, because the view changes on every scroll.
  const sync = () => {
    const view = getView()
    const thumb = thumbRef.current
    const today = todayRef.current
    if (!view || !thumb || !today) return
    // Held still during a drag, so the strip does not rescale under the pointer.
    const extent = (dragRef.current?.extentEnd ?? extentEndOf(view)) - start
    thumb.style.left = `${((view.start - start) / extent) * 100}%`
    thumb.style.width = `${((view.end - view.start) / extent) * 100}%`
    today.style.left = `${((now - start) / extent) * 100}%`
  }

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    sync()
    scroller?.addEventListener('scroll', sync, { passive: true })
    return () => scroller?.removeEventListener('scroll', sync)
  })

  const startDrag = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
    const view = getView()
    const track = trackRef.current
    if (!view || !track) return
    track.setPointerCapture(event.pointerId)
    track.dataset.drag = mode
    const extentEnd = extentEndOf(view)
    dragRef.current = {
      mode,
      pointerX: event.clientX,
      view,
      extentEnd,
      msPerPixel: (extentEnd - start) / track.clientWidth,
    }
  }

  const onPointerDown =
    (mode: DragMode) => (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      startDrag(event, mode)
    }

  // Pressing the strip outside the thumb brings the view there, then pans.
  const onTrackPointerDown = (event: PointerEvent<HTMLElement>) => {
    const view = getView()
    const track = trackRef.current
    if (event.button !== 0 || !view || !track) return
    event.preventDefault()
    const extentEnd = extentEndOf(view)
    const span = view.end - view.start
    const time =
      start +
      ((event.clientX - track.getBoundingClientRect().left) /
        track.clientWidth) *
        (extentEnd - start)
    setView(clamp(time - span / 2, start, extentEnd - span), view.pixelsPerDay)
    startDrag(event, 'pan')
    sync()
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const { view, mode } = drag
    const delta = (event.clientX - drag.pointerX) * drag.msPerPixel
    const span = view.end - view.start
    if (mode === 'pan') {
      setView(
        clamp(view.start + delta, start, drag.extentEnd - span),
        view.pixelsPerDay,
      )
    } else if (event.altKey) {
      // With Alt held, both ends move by the same amount around the middle.
      const middle = (view.start + view.end) / 2
      const reach = Math.min(middle - start, drag.extentEnd - middle)
      const half = clamp(
        mode === 'end' ? span / 2 + delta : span / 2 - delta,
        ((view.width / MAX_PIXELS_PER_DAY) * DAY_MS) / 2,
        reach,
      )
      setView(middle - half, (view.width * DAY_MS) / (half * 2))
    } else {
      const minSpan = (view.width / MAX_PIXELS_PER_DAY) * DAY_MS
      // The widest view is the whole strip, from one end to the other.
      const nextSpan = Math.max(
        minSpan,
        mode === 'end'
          ? Math.min(view.end + delta, drag.extentEnd) - view.start
          : view.end - Math.max(view.start + delta, start),
      )
      setView(
        mode === 'end' ? view.start : view.end - nextSpan,
        (view.width * DAY_MS) / nextSpan,
      )
    }
    sync()
  }

  const endDrag = () => {
    dragRef.current = null
    delete trackRef.current?.dataset.drag
    sync()
  }

  return (
    <div
      ref={trackRef}
      className={TRACK_CLASS}
      onPointerDown={onTrackPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        ref={thumbRef}
        className={THUMB_CLASS}
        onPointerDown={onPointerDown('pan')}
      >
        <div
          className={`${GRIP_CLASS} left-0`}
          onPointerDown={onPointerDown('start')}
        />
        <div
          className={`${GRIP_CLASS} right-0`}
          onPointerDown={onPointerDown('end')}
        />
      </div>
      <div ref={todayRef} className={TODAY_CLASS} />
    </div>
  )
}
