import { useRef } from 'react'
import { formatGanttDate } from './scale'

export const useGanttPointer = (toTime: (x: number) => number, now: number) => {
  const trackRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLElement>(null)
  const cursorLabelRef = useRef<HTMLSpanElement>(null)
  const clientXRef = useRef<number | null>(null)

  const hide = () => {
    clientXRef.current = null
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0'
    }
  }

  // Also runs on scroll, where the content moves under a pointer that has not.
  const syncCursor = () => {
    const track = trackRef.current
    const cursor = cursorRef.current
    if (!track || !cursor || clientXRef.current === null) return
    const x = clientXRef.current - track.getBoundingClientRect().left
    cursor.style.transform = `translateX(${x}px)`
    cursor.style.opacity = '1'
    if (cursorLabelRef.current) {
      cursorLabelRef.current.textContent = formatGanttDate(toTime(x), now)
    }
  }

  const onMouseMove = (event: React.MouseEvent) => {
    if (!(event.target as HTMLElement).closest('[data-gantt-rows]')) {
      hide()
      return
    }
    clientXRef.current = event.clientX
    syncCursor()
  }

  return {
    trackRef,
    cursorRef,
    cursorLabelRef,
    onMouseMove,
    onMouseLeave: hide,
    syncCursor,
  }
}
