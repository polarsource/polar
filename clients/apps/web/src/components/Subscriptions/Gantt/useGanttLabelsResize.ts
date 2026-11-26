import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import { LABELS_WIDTH_VAR } from './scale'

const MIN_WIDTH = 120
const MAX_WIDTH = 560
const KEY_STEP = 16
const STORAGE_KEY = 'gantt_labels_width'

const isStoredWidth = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

// The label column's width is a CSS variable on the scroller. Dragging writes
// it straight to the DOM, and the result is kept once the drag ends. Without a
// kept width the variable falls back to the default set in the stylesheet.
export const useGanttLabelsResize = (
  scrollerRef: RefObject<HTMLElement | null>,
  labelsRef: RefObject<HTMLElement | null>,
) => {
  const [width, setWidth] = useLocalStorage<number | null>(STORAGE_KEY, null, {
    validate: isStoredWidth,
  })
  const dragRef = useRef<{ pointerX: number; width: number } | null>(null)
  const liveWidthRef = useRef<number | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !labelsRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerX: event.clientX,
      width: labelsRef.current.offsetWidth,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const scroller = scrollerRef.current
    if (!drag || !scroller) return
    const next = clampWidth(
      drag.width + event.clientX - drag.pointerX,
      scroller,
    )
    liveWidthRef.current = next
    scroller.style.setProperty(LABELS_WIDTH_VAR, `${next}px`)
  }

  // Always leaves some of the timeline in view.
  const clampWidth = (value: number, scroller: HTMLElement) =>
    Math.round(
      Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, scroller.clientWidth * 0.6, value),
      ),
    )

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const scroller = scrollerRef.current
    const labels = labelsRef.current
    if (!scroller || !labels) return
    if (event.key === 'Enter') {
      setWidth(null)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const step = event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP
      setWidth(clampWidth(labels.offsetWidth + step, scroller))
    } else {
      return
    }
    event.preventDefault()
  }

  const endDrag = () => {
    if (!dragRef.current) return
    dragRef.current = null
    if (liveWidthRef.current !== null) {
      setWidth(liveWidthRef.current)
      liveWidthRef.current = null
    }
  }

  return {
    // Capped against the frame, like a drag is, so a width kept from a wider
    // frame cannot cover a narrower one. The frame is the query container.
    style:
      width === null
        ? undefined
        : ({ [LABELS_WIDTH_VAR]: `min(${width}px, 60cqw)` } as CSSProperties),
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onDoubleClick: () => setWidth(null),
      onKeyDown,
      tabIndex: 0,
    },
  }
}
